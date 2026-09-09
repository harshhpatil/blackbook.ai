import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isValidObjectId } from 'mongoose';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import { Asset, AssetKind, IAsset } from '../assets_module/models/Asset.model.ts';
import { Project } from '../project_module/models/Project.model.ts';
import { GenerationJob } from './models/GenerationJob.model.ts';
import {
  createAssetKey,
  getAssetStream,
  uploadAsset,
} from '../../core/services/storage.service.ts';
// The root service is JavaScript by design and is the canonical DocMorph engine.
// @ts-ignore: root template_engine is a JavaScript service package without declarations.
import { extractPlaceholders, fillTemplate } from '../../../../template_engine/services/template.js';
// @ts-ignore: root template_engine is a JavaScript service package without declarations.
import { extractText } from '../../../../template_engine/services/extractText.js';
// @ts-ignore: root template_engine is a JavaScript service package without declarations.
import { extractStructuredData } from '../../../../template_engine/services/gemini.js';
// @ts-ignore: root template_engine is a JavaScript service package without declarations.
import { suggestFieldMappings, applyTemplateMapping } from '../../../../template_engine/services/trainer.js';
// @ts-ignore: root template_engine is a JavaScript service package without declarations.
import { convertToPdf } from '../../../../template_engine/services/pdf.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const contentTypeFor = (filename: string): string => {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === '.pdf') return 'application/pdf';
  if (extension === '.txt' || extension === '.md') return 'text/plain; charset=utf-8';
  return 'application/octet-stream';
};

const findProject = (projectId: unknown, userId: string) =>
  typeof projectId === 'string' && isValidObjectId(projectId)
    ? Project.findOne({ _id: projectId, userId })
    : null;

const findAsset = async (assetId: unknown, userId: string, kinds: AssetKind[]) => {
  if (typeof assetId !== 'string' || !isValidObjectId(assetId)) return null;
  return Asset.findOne({ _id: assetId, owner: userId, kind: { $in: kinds } });
};

const saveR2Asset = async (
  file: Express.Multer.File,
  owner: string,
  projectId: string,
  kind: 'template' | 'raw' | 'export-docx' | 'export-pdf'
) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const key = createAssetKey(owner, kind, extension, projectId);
  await uploadAsset(key, file.buffer, file.mimetype || contentTypeFor(file.originalname));
  return Asset.create({
    owner,
    project: projectId,
    key,
    kind,
    originalFilename: file.originalname,
    contentType: file.mimetype || contentTypeFor(file.originalname),
    size: file.size,
  });
};

const writeR2AssetToTemp = async (asset: IAsset, directory: string): Promise<string> => {
  const filename = path.basename(asset.originalFilename);
  const destination = path.join(directory, filename);
  await pipeline(await getAssetStream(asset.key), (await import('node:fs')).createWriteStream(destination));
  return destination;
};

const createTempWorkspace = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blackbook-docmorph-'));
  const templates = path.join(root, 'templates');
  const uploads = path.join(root, 'uploads');
  const outputs = path.join(root, 'outputs');
  await Promise.all([fs.mkdir(templates), fs.mkdir(uploads), fs.mkdir(outputs)]);
  return { root, templates, uploads, outputs };
};

router.use(authenticate);
router.use(csrfProtection);

router.post('/raw', upload.single('raw'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No raw data file uploaded' });
    const project = await findProject(req.body.projectId, req.user!.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const asset = await saveR2Asset(req.file, req.user!.id, project._id.toString(), 'raw');
    return res.status(200).json({ success: true, message: 'Raw data uploaded', assetId: asset._id, filename: asset.originalFilename });
  } catch (error) {
    next(error);
  }
});

router.post('/template', upload.single('template'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No template file uploaded' });
    const project = await findProject(req.body.projectId, req.user!.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const workspace = await createTempWorkspace();
    try {
      const temporaryTemplate = path.join(workspace.templates, req.file.originalname);
      await fs.writeFile(temporaryTemplate, req.file.buffer);
      const fields = await extractPlaceholders(temporaryTemplate);
      const asset = await saveR2Asset(req.file, req.user!.id, project._id.toString(), 'template');
      return res.status(200).json({ success: true, assetId: asset._id, filename: asset.originalFilename, fields });
    } finally {
      await fs.rm(workspace.root, { recursive: true, force: true });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  const workspace = await createTempWorkspace();
  try {
    const { projectId, templateAssetId, rawAssetId } = req.body as Record<string, string>;
    const project = await findProject(projectId, req.user!.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const [template, raw] = await Promise.all([
      findAsset(templateAssetId, req.user!.id, ['template']),
      findAsset(rawAssetId, req.user!.id, ['raw', 'source']),
    ]);
    if (!template || !raw) return res.status(404).json({ success: false, error: 'Template or raw asset not found' });

    const templatePath = await writeR2AssetToTemp(template, workspace.templates);
    const rawPath = await writeR2AssetToTemp(raw, workspace.uploads);
    const fields = await extractPlaceholders(templatePath);
    const rawText = await extractText(rawPath);
    const data = await extractStructuredData(rawText, fields);
    const stamp = Date.now();
    const docxFilename = `report-${stamp}.docx`;
    const generatedDocxPath = await fillTemplate(templatePath, data, {}, docxFilename);
    const docxBuffer = await fs.readFile(generatedDocxPath);
    const docxAsset = await saveR2Asset({
      buffer: docxBuffer,
      originalname: docxFilename,
      mimetype: contentTypeFor(docxFilename),
      size: docxBuffer.length,
    } as Express.Multer.File, req.user!.id, project._id.toString(), 'export-docx');

    let pdfAsset: IAsset | undefined;
    try {
      const pdfFilename = `report-${stamp}.pdf`;
      const pdfPath = path.join(workspace.outputs, pdfFilename);
      await convertToPdf(generatedDocxPath, pdfPath);
      const pdfBuffer = await fs.readFile(pdfPath);
      pdfAsset = await saveR2Asset({
        buffer: pdfBuffer,
        originalname: pdfFilename,
        mimetype: 'application/pdf',
        size: pdfBuffer.length,
      } as Express.Multer.File, req.user!.id, project._id.toString(), 'export-pdf');
    } catch {
      // DOCX remains available when LibreOffice is unavailable.
    }

    const job = await GenerationJob.create({ user: req.user!.id, project: project._id, templateAsset: template._id, sourceAsset: raw._id, status: 'completed', result: { docxAsset: docxAsset._id, ...(pdfAsset ? { pdfAsset: pdfAsset._id } : {}) } });
    project.status = 'completed';
    project.contentData = data;
    project.downloads = { docxAsset: docxAsset._id, ...(pdfAsset ? { pdfAsset: pdfAsset._id } : {}) };
    await project.save();
    return res.status(200).json({ success: true, generationJobId: job._id, projectId: project._id, docx: `/api/v1/assets/${docxAsset._id}/download`, pdf: pdfAsset ? `/api/v1/assets/${pdfAsset._id}/download` : null });
  } catch (error) {
    next(error);
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});

router.post('/train/analyze', upload.single('filledDoc'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No filled document uploaded' });
    const project = await findProject(req.body.projectId, req.user!.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const workspace = await createTempWorkspace();
    try {
      const temporarySource = path.join(workspace.uploads, req.file.originalname);
      await fs.writeFile(temporarySource, req.file.buffer);
      const suggestions = await suggestFieldMappings(await extractText(temporarySource));
      const asset = await saveR2Asset(req.file, req.user!.id, project._id.toString(), 'raw');
      return res.status(200).json({ success: true, message: 'Analysis complete — review and approve before applying', assetId: asset._id, filename: asset.originalFilename, suggestions });
    } finally {
      await fs.rm(workspace.root, { recursive: true, force: true });
    }
  } catch (error) {
    next(error);
  }
});

router.post('/train/confirm', async (req, res, next) => {
  const workspace = await createTempWorkspace();
  try {
    const { projectId, sourceAssetId, approvedMapping, templateName } = req.body as { projectId?: string; sourceAssetId?: string; approvedMapping?: Record<string, string>; templateName?: string };
    if (!projectId || !sourceAssetId || !approvedMapping || !Object.keys(approvedMapping).length) return res.status(400).json({ success: false, error: 'Need projectId, sourceAssetId and approvedMapping' });
    const project = await findProject(projectId, req.user!.id);
    const source = await findAsset(sourceAssetId, req.user!.id, ['raw', 'source']);
    if (!project || !source) return res.status(404).json({ success: false, error: 'Source asset not found' });
    const sourcePath = await writeR2AssetToTemp(source, workspace.uploads);
    const outputFilename = `${(templateName || `trained-template-${Date.now()}`).replace(/[^a-z0-9-_]/gi, '_')}.docx`;
    const outputPath = path.join(workspace.templates, outputFilename);
    const result = applyTemplateMapping(sourcePath, approvedMapping, outputPath);
    const outputBuffer = await fs.readFile(outputPath);
    const templateAsset = await saveR2Asset({ buffer: outputBuffer, originalname: outputFilename, mimetype: contentTypeFor(outputFilename), size: outputBuffer.length } as Express.Multer.File, req.user!.id, project._id.toString(), 'template');
    return res.status(200).json({ success: true, message: 'Template trained and saved', templateAssetId: templateAsset._id, appliedFields: result.applied, skippedFields: result.skipped });
  } catch (error) {
    next(error);
  } finally {
    await fs.rm(workspace.root, { recursive: true, force: true });
  }
});

export default router;
