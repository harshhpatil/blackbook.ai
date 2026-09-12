import { Router } from 'express';
import crypto from 'node:crypto';
import multer from 'multer';
import path from 'node:path';
import { isValidObjectId } from 'mongoose';
import { authenticate } from '../authentication_module/middlewares/auth.middleware.ts';
import { csrfProtection } from '../../core/middlewares/csrf.middleware.ts';
import { Asset, AssetKind, IAsset } from '../assets_module/models/Asset.model.ts';
import { Project } from '../project_module/models/Project.model.ts';
import { GenerationJob } from './models/GenerationJob.model.ts';
import {
  createAssetKey,
  getAssetBuffer,
  getAssetDownloadUrl,
  uploadAsset,
} from '../../core/services/storage.service.ts';
import { docmorphClient } from './services/docmorphClient.service.ts';

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

const asStringRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

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
    const asset = await saveR2Asset(req.file, req.user!.id, project._id.toString(), 'template');
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const analysis = await docmorphClient.uploadTemplate({
      url: await getAssetDownloadUrl(asset.key),
      filename: asset.originalFilename,
      contentType: asset.contentType,
    }, requestId);
    const fields = Array.isArray(analysis.fields)
      ? analysis.fields.filter((field): field is string => typeof field === 'string')
      : [];
    return res.status(200).json({ success: true, assetId: asset._id, filename: asset.originalFilename, fields });
  } catch (error) {
    next(error);
  }
});

router.post('/generate', async (req, res, next) => {
  try {
    const { projectId, templateAssetId, rawAssetId } = req.body as Record<string, string>;
    const project = await findProject(projectId, req.user!.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const [template, raw] = await Promise.all([
      findAsset(templateAssetId, req.user!.id, ['template']),
      findAsset(rawAssetId, req.user!.id, ['raw', 'source']),
    ]);
    if (!template || !raw) return res.status(404).json({ success: false, error: 'Template or raw asset not found' });

    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const generated = await docmorphClient.generateReport({
      template: { url: await getAssetDownloadUrl(template.key), filename: template.originalFilename, contentType: template.contentType },
      raw: { url: await getAssetDownloadUrl(raw.key), filename: raw.originalFilename, contentType: raw.contentType },
    }, requestId);
    
    if (typeof generated.docxUrl !== 'string') {
      throw new Error('DocMorph did not return a DOCX artifact URL');
    }

    const safeTitle = (project.title || 'blackbook').replace(/[^a-z0-9_-]/gi, '_');
    const docxKey = generated.docxKey || `template-engine/outputs/${project._id}-${Date.now()}.docx`;
    const docxAsset = await Asset.create({
      owner: req.user!.id,
      project: project._id,
      key: docxKey,
      kind: 'export-docx',
      originalFilename: `${safeTitle}.docx`,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: generated.docxSize || 50000,
    });

    let pdfAsset = null;
    if (generated.pdfUrl && generated.pdfKey) {
      pdfAsset = await Asset.create({
        owner: req.user!.id,
        project: project._id,
        key: generated.pdfKey,
        kind: 'export-pdf',
        originalFilename: `${safeTitle}.pdf`,
        contentType: 'application/pdf',
        size: generated.pdfSize || 100000,
      });
    }

    const job = await GenerationJob.create({ 
      user: req.user!.id, 
      project: project._id, 
      templateAsset: template._id, 
      sourceAsset: raw._id, 
      status: 'completed', 
      result: { docxUrl: generated.docxUrl, ...(generated.pdfUrl ? { pdfUrl: generated.pdfUrl } : {}) } 
    });
    
    project.status = 'completed';
    project.contentData = asStringRecord(generated.data);
    project.downloads = { docxUrl: generated.docxUrl, ...(generated.pdfUrl ? { pdfUrl: generated.pdfUrl } : {}) };
    await project.save();
    return res.status(200).json({
      success: true,
      generationJobId: job._id,
      projectId: project._id,
      docx: generated.docxUrl,
      pdf: generated.pdfUrl || null,
      docxAssetId: docxAsset._id,
      pdfAssetId: pdfAsset?._id || null,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/train/analyze', upload.single('filledDoc'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No filled document uploaded' });
    const project = await findProject(req.body.projectId, req.user!.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    const asset = await saveR2Asset(req.file, req.user!.id, project._id.toString(), 'raw');
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const analysis = await docmorphClient.trainAnalyze({
      url: await getAssetDownloadUrl(asset.key),
      filename: asset.originalFilename,
      contentType: asset.contentType,
    }, requestId);
    return res.status(200).json({ success: true, message: 'Analysis complete — review and approve before applying', assetId: asset._id, filename: asset.originalFilename, suggestions: analysis.suggestions ?? {} });
  } catch (error) {
    next(error);
  }
});

router.post('/train/confirm', async (req, res, next) => {
  try {
    const { projectId, sourceAssetId, approvedMapping, templateName } = req.body as { projectId?: string; sourceAssetId?: string; approvedMapping?: Record<string, string>; templateName?: string };
    if (!projectId || !sourceAssetId || !approvedMapping || !Object.keys(approvedMapping).length) return res.status(400).json({ success: false, error: 'Need projectId, sourceAssetId and approvedMapping' });
    const project = await findProject(projectId, req.user!.id);
    const source = await findAsset(sourceAssetId, req.user!.id, ['raw', 'source']);
    if (!project || !source) return res.status(404).json({ success: false, error: 'Source asset not found' });
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    const result = await docmorphClient.trainConfirm({
      source: { url: await getAssetDownloadUrl(source.key), filename: source.originalFilename, contentType: source.contentType },
      approvedMapping,
      templateName,
    }, requestId);
    
    if (typeof result.templateUrl !== 'string') throw new Error('DocMorph did not return a trained template URL');
    return res.status(200).json({ success: true, message: 'Template trained and saved', templateUrl: result.templateUrl, appliedFields: result.appliedFields, skippedFields: result.skippedFields });
  } catch (error) {
    next(error);
  }
});

export default router;
