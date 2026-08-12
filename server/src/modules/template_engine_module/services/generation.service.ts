import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Asset, IAsset } from '../../assets_module/models/Asset.model.ts';
import { GenerationJob } from '../models/GenerationJob.model.ts';
import { Project } from '../../project_module/models/Project.model.ts';
import {
  createAssetKey,
  deleteAsset,
  getAssetStream,
  uploadAsset,
} from '../../../core/services/storage.service.ts';
import { extractText } from '../controllers/extractText.controller.ts';
import { extractStructuredData } from '../controllers/gemini.controller.ts';
import {
  extractPlaceholders,
  fillTemplate,
} from '../controllers/template.controller.ts';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * @function downloadToTemp
 * @description Streams a remote asset from storage into an isolated local temporary directory.
 */
const downloadToTemp = async (
  asset: IAsset,
  directory: string
): Promise<string> => {
  const destination = path.join(
    directory,
    `${asset._id.toString()}${path.extname(asset.originalFilename) || '.bin'}`
  );
  await pipeline(
    await getAssetStream(asset.key),
    createWriteStream(destination)
  );
  return destination;
};

/**
 * @function persistExport
 * @description Uploads a compiled export buffer to object storage and records it as an Asset in MongoDB.
 */
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
    return await Asset.create({
      owner: userId,
      project: projectId,
      key,
      kind,
      originalFilename: filename,
      contentType,
      size: buffer.length,
    });
  } catch (error) {
    await deleteAsset(key).catch(() => undefined);
    throw error;
  }
};

/**
 * @function processGenerationJob
 * @description The orchestrator function for the document generation pipeline.
 */
export async function processGenerationJob(
  generationJobId: string
): Promise<void> {
  const job = await GenerationJob.findById(generationJobId);
  if (!job) throw new Error('Generation job not found');

  const project = await Project.findOne({ _id: job.project, userId: job.user });
  if (!project) throw new Error('Generation project not found');

  const [template, source] = await Promise.all([
    Asset.findOne({
      _id: job.templateAsset,
      owner: job.user,
      project: project._id,
      kind: 'template',
    }),
    Asset.findOne({
      _id: job.sourceAsset,
      owner: job.user,
      project: project._id,
      kind: 'source',
    }),
  ]);

  if (!template || !source)
    throw new Error('Generation input assets no longer exist in the project');

  // Mark states as processing
  job.status = 'processing';
  job.error = undefined;
  await job.save();
  project.status = 'processing';
  project.lastError = undefined;
  await project.save();

  // Create isolated temp workspace
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'blackbook-'));
  try {
    const [templatePath, sourcePath] = await Promise.all([
      downloadToTemp(template, directory),
      downloadToTemp(source, directory),
    ]);

    const fields = await extractPlaceholders(templatePath);
    if (!fields.length)
      throw new Error('No {{placeholders}} found in this template');

    const rawText = await extractText(sourcePath);
    const data = await extractStructuredData(rawText, fields);

    const docxFilename = `blackbook-${Date.now()}.docx`;

    // FIX: Added the 'await' keyword here!
    const docxPath = await fillTemplate(
      templatePath,
      data,
      path.join(directory, docxFilename)
    );

    const docxAsset = await persistExport(
      await fs.readFile(docxPath),
      job.user.toString(),
      project._id.toString(),
      'export-docx',
      docxFilename,
      DOCX_CONTENT_TYPE
    );

    let pdfAsset: IAsset | undefined;
    try {
      const { convertToPdf } = await import('../controllers/pdf.controller.ts');
      const pdfFilename = `blackbook-${Date.now()}.pdf`;
      const pdfPath = path.join(directory, pdfFilename);
      await convertToPdf(docxPath, pdfPath);
      pdfAsset = await persistExport(
        await fs.readFile(pdfPath),
        job.user.toString(),
        project._id.toString(),
        'export-pdf',
        pdfFilename,
        'application/pdf'
      );
    } catch {
      // Graceful degradation: A DOCX is still a successful generation if LibreOffice/PDF conversion fails.
    }

    // Finalize Project Success
    project.status = 'completed';
    project.contentData = data;
    project.downloads = {
      docxAsset: docxAsset._id,
      ...(pdfAsset ? { pdfAsset: pdfAsset._id } : {}),
    };
    await project.save();

    // Finalize Job Success
    job.status = 'completed';
    job.result = {
      docxAsset: docxAsset._id,
      ...(pdfAsset ? { pdfAsset: pdfAsset._id } : {}),
    };
    await job.save();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : 'Generation failed';

    project.status = 'failed';
    project.lastError = message;
    await project.save().catch(() => undefined);

    job.status = 'failed';
    job.error = message;
    await job.save().catch(() => undefined);

    throw error;
  } finally {
    // Guaranteed disk cleanup to prevent memory/storage bloat
    await fs.rm(directory, { recursive: true, force: true });
  }
}
