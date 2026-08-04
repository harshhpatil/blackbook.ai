import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Asset, IAsset } from '../models/Asset.model.ts';
import { GenerationJob } from '../models/GenerationJob.model.ts';
import { Project } from '../models/Project.model.ts';
import { createAssetKey, deleteAsset, getAssetStream, uploadAsset } from './storage.service.ts';
import { extractText } from '../controllers/template-engine/extractText.controller.ts';
import { extractStructuredData } from '../controllers/template-engine/gemini.controller.ts';
import { extractPlaceholders, fillTemplate } from '../controllers/template-engine/template.controller.ts';

const DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const downloadToTemp = async (asset: IAsset, directory: string): Promise<string> => {
  const destination = path.join(directory, `${asset._id.toString()}${path.extname(asset.originalFilename) || '.bin'}`);
  await pipeline(await getAssetStream(asset.key), createWriteStream(destination));
  return destination;
};

const persistExport = async (
  buffer: Buffer,
  userId: string,
  projectId: string,
  kind: 'export-docx' | 'export-pdf',
  filename: string,
  contentType: string
): Promise<IAsset> => {
  const key = createAssetKey(userId, kind, path.extname(filename), projectId);
  await uploadAsset(key, buffer, contentType);
  try {
    return await Asset.create({ owner: userId, project: projectId, key, kind, originalFilename: filename, contentType, size: buffer.length });
  } catch (error) {
    await deleteAsset(key).catch(() => undefined);
    throw error;
  }
};

export async function processGenerationJob(generationJobId: string): Promise<void> {
  const job = await GenerationJob.findById(generationJobId);
  if (!job) throw new Error('Generation job not found');

  const project = await Project.findOne({ _id: job.project, userId: job.user });
  if (!project) throw new Error('Generation project not found');
  const [template, source] = await Promise.all([
    Asset.findOne({ _id: job.templateAsset, owner: job.user, project: project._id, kind: 'template' }),
    Asset.findOne({ _id: job.sourceAsset, owner: job.user, project: project._id, kind: 'source' }),
  ]);
  if (!template || !source) throw new Error('Generation input assets no longer exist in the project');

  job.status = 'processing';
  job.error = undefined;
  await job.save();
  project.status = 'processing';
  project.lastError = undefined;
  await project.save();

  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blackbook-'));
  try {
    const [templatePath, sourcePath] = await Promise.all([downloadToTemp(template, directory), downloadToTemp(source, directory)]);
    const fields = await extractPlaceholders(templatePath);
    if (!fields.length) throw new Error('No {{placeholders}} found in this template');
    const rawText = await extractText(sourcePath);
    const data = await extractStructuredData(rawText, fields);

    const docxFilename = `blackbook-${Date.now()}.docx`;
    const docxPath = fillTemplate(templatePath, data, path.join(directory, docxFilename));
    const docxAsset = await persistExport(await fs.readFile(docxPath), job.user.toString(), project._id.toString(), 'export-docx', docxFilename, DOCX_CONTENT_TYPE);

    let pdfAsset: IAsset | undefined;
    try {
      const { convertToPdf } = await import('../controllers/template-engine/pdf.controller.ts');
      const pdfFilename = `blackbook-${Date.now()}.pdf`;
      const pdfPath = path.join(directory, pdfFilename);
      await convertToPdf(docxPath, pdfPath);
      pdfAsset = await persistExport(await fs.readFile(pdfPath), job.user.toString(), project._id.toString(), 'export-pdf', pdfFilename, 'application/pdf');
    } catch {
      // A DOCX is still a successful generation if LibreOffice is unavailable.
    }

    project.status = 'completed';
    project.contentData = data;
    project.downloads = { docxAsset: docxAsset._id, ...(pdfAsset ? { pdfAsset: pdfAsset._id } : {}) };
    await project.save();
    job.status = 'completed';
    job.result = { docxAsset: docxAsset._id, ...(pdfAsset ? { pdfAsset: pdfAsset._id } : {}) };
    await job.save();
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : 'Generation failed';
    project.status = 'failed';
    project.lastError = message;
    await project.save().catch(() => undefined);
    job.status = 'failed';
    job.error = message;
    await job.save().catch(() => undefined);
    throw error;
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
