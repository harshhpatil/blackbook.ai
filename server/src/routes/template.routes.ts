import { Router } from 'express';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import multer from 'multer';
import { isValidObjectId } from 'mongoose';

import { authenticate } from '../middlewares/auth.middleware.ts';
import { csrfProtection } from '../middlewares/csrf.middleware.ts';
import { Asset, AssetKind, IAsset } from '../models/Asset.model.ts';
import { IProject, Project } from '../models/Project.model.ts';
import {
  createAssetKey,
  deleteAsset,
  getAssetStream,
  uploadAsset,
} from '../services/storage.service.ts';
import { extractText } from '../controllers/template-engine/extractText.controller.ts';
import { extractPlaceholders } from '../controllers/template-engine/template.controller.ts';
import {
  applyTemplateMapping,
  suggestFieldMappings,
} from '../controllers/template-engine/trainer.controller.ts';
import { GenerationJob } from '../models/GenerationJob.model.ts';
import { enqueueGeneration } from '../services/generationQueue.service.ts';
import {
  chargeGenerationCredits,
  refundGenerationCredits,
} from '../services/credit.service.ts';

const router = Router();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const contentTypeFor = (extension: string): string => {
  switch (extension.toLowerCase()) {
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
};

const ensureExtension = (
  file: Express.Multer.File,
  allowed: string[]
): string => {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(extension))
    throw new Error(`unsupported file type: ${extension || 'unknown'}`);
  return extension;
};

const persistUpload = async (
  file: Express.Multer.File,
  owner: string,
  project: IProject,
  kind: AssetKind,
  allowedExtensions: string[]
): Promise<IAsset> => {
  const extension = ensureExtension(file, allowedExtensions);
  const key = createAssetKey(owner, kind, extension, project._id.toString());
  const contentType = contentTypeFor(extension);
  await uploadAsset(key, file.buffer, contentType);

  try {
    return await Asset.create({
      owner,
      project: project._id,
      key,
      kind,
      originalFilename: path.basename(file.originalname),
      contentType,
      size: file.size,
    });
  } catch (error) {
    await deleteAsset(key).catch(() => undefined);
    throw error;
  }
};

const downloadToTemp = async (
  asset: IAsset,
  directory: string
): Promise<string> => {
  const extension = path.extname(asset.originalFilename) || '.bin';
  const destination = path.join(
    directory,
    `${asset._id.toString()}${extension}`
  );
  await pipeline(
    await getAssetStream(asset.key),
    createWriteStream(destination)
  );
  return destination;
};

const findOwnedAsset = async (
  assetId: string,
  owner: string,
  kind: AssetKind
): Promise<IAsset | null> => Asset.findOne({ _id: assetId, owner, kind });

const findOwnedProject = async (
  projectId: unknown,
  owner: string
): Promise<IProject | null> => {
  if (typeof projectId !== 'string' || !isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, userId: owner });
};

router.use(authenticate);
router.use(csrfProtection);

router.post('/template', upload.single('template'), async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: 'No template file uploaded' });
    const project = await findOwnedProject(req.body.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const asset = await persistUpload(
      req.file,
      req.user.id,
      project,
      'template',
      ['.docx']
    );
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blackbook-'));
    try {
      const templatePath = await downloadToTemp(asset, directory);
      const fields = await extractPlaceholders(templatePath);
      return res.status(201).json({
        message: `Template uploaded — found ${fields.length} field${fields.length === 1 ? '' : 's'}`,
        assetId: asset._id,
        fields,
      });
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/raw', upload.single('raw'), async (req, res, next) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: 'No raw data file uploaded' });
    const project = await findOwnedProject(req.body.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const asset = await persistUpload(
      req.file,
      req.user.id,
      project,
      'source',
      ['.pdf', '.docx', '.txt']
    );
    return res
      .status(201)
      .json({ message: 'Raw data uploaded', assetId: asset._id });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  const { projectId, templateAssetId, rawAssetId } = req.body as {
    projectId?: string;
    templateAssetId?: string;
    rawAssetId?: string;
  };
  if (!projectId || !templateAssetId || !rawAssetId)
    return res
      .status(400)
      .json({
        error: 'Need projectId, templateAssetId and rawAssetId to generate',
      });
  try {
    const project = await findOwnedProject(projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.status === 'processing')
      return res
        .status(409)
        .json({ error: 'This project already has a generation in progress' });
    const [template, source] = await Promise.all([
      findOwnedAsset(templateAssetId, req.user.id, 'template'),
      findOwnedAsset(rawAssetId, req.user.id, 'source'),
    ]);
    if (
      !template ||
      !source ||
      template.project?.toString() !== project._id.toString() ||
      source.project?.toString() !== project._id.toString()
    ) {
      return res
        .status(404)
        .json({ error: 'Template or source asset not found in this project' });
    }
    const generationJob = await GenerationJob.create({
      user: req.user.id,
      project: project._id,
      templateAsset: template._id,
      sourceAsset: source._id,
    });
    try {
      await chargeGenerationCredits(req.user.id, generationJob._id.toString());
      project.status = 'processing';
      project.lastError = undefined;
      await project.save();
      await enqueueGeneration(generationJob._id.toString());
    } catch (error) {
      await refundGenerationCredits(
        req.user.id,
        generationJob._id.toString()
      ).catch(() => undefined);
      await GenerationJob.findByIdAndDelete(generationJob._id).catch(
        () => undefined
      );
      if (project.status === 'processing') {
        project.status = 'failed';
        project.lastError = 'Unable to queue generation';
        await project.save();
      }
      throw error;
    }
    return res
      .status(202)
      .json({
        message: 'Document generation queued',
        generationJobId: generationJob._id,
        projectId: project._id,
      });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/train/analyze',
  upload.single('filledDoc'),
  async (req, res, next) => {
    try {
      if (!req.file)
        return res.status(400).json({ error: 'No filled document uploaded' });
      const project = await findOwnedProject(req.body.projectId, req.user.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const asset = await persistUpload(
        req.file,
        req.user.id,
        project,
        'source',
        ['.docx']
      );
      const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blackbook-'));
      try {
        const sourcePath = await downloadToTemp(asset, directory);
        const suggestions = await suggestFieldMappings(
          await extractText(sourcePath)
        );
        return res.json({
          message: 'Analysis complete — review and approve before applying',
          assetId: asset._id,
          suggestions,
        });
      } finally {
        await fs.rm(directory, { recursive: true, force: true });
      }
    } catch (error) {
      next(error);
    }
  }
);

router.post('/train/confirm', async (req, res, next) => {
  const { projectId, sourceAssetId, approvedMapping, templateName } =
    req.body as {
      projectId?: string;
      sourceAssetId?: string;
      approvedMapping?: Record<string, string>;
      templateName?: string;
    };
  if (
    !projectId ||
    !sourceAssetId ||
    !approvedMapping ||
    !Object.keys(approvedMapping).length
  )
    return res
      .status(400)
      .json({
        error:
          'Need projectId, sourceAssetId and at least one approved field mapping',
      });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blackbook-'));
  try {
    const project = await findOwnedProject(projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const source = await findOwnedAsset(sourceAssetId, req.user.id, 'source');
    if (!source || source.project?.toString() !== project._id.toString())
      return res
        .status(404)
        .json({ error: 'Source asset not found in this project' });
    const sourcePath = await downloadToTemp(source, directory);
    const safeName =
      templateName?.replace(/[^a-z0-9-_]/gi, '_') ||
      `trained-template-${Date.now()}`;
    const outputPath = path.join(directory, `${safeName}.docx`);
    const result = applyTemplateMapping(
      sourcePath,
      approvedMapping,
      outputPath
    );
    const buffer = await fs.readFile(outputPath);
    const asset = await persistUpload(
      {
        originalname: `${safeName}.docx`,
        buffer,
        size: buffer.length,
      } as Express.Multer.File,
      req.user.id,
      project,
      'template',
      ['.docx']
    );
    return res
      .status(201)
      .json({
        message: 'Template trained and saved',
        templateAssetId: asset._id,
        appliedFields: result.applied,
        skippedFields: result.skipped,
      });
  } catch (error) {
    next(error);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

export default router;
