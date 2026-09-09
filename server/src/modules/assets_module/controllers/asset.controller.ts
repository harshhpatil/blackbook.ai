import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { pipeline } from 'node:stream/promises';
import { Asset } from '../models/Asset.model.ts';
import { getAssetStream } from '../../../core/services/storage.service.ts';

/**
 * @function downloadAsset
 * @description Streams a secure, private file directly from the storage bucket to the user's browser.
 * Validates ownership to ensure users cannot download files belonging to others.
 *
 * @param {Request} req - Express request containing the assetId parameter.
 * @param {Response} res - Express response object.
 * @param {NextFunction} next - Express next middleware function for error handling.
 * @returns {Promise<void>} Pipes the file stream directly to the response.
 */
export async function downloadAsset(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    if (!isValidObjectId(req.params.assetId)) {
      return res.status(400).json({ message: 'Invalid asset ID format' });
    }

    const asset = await Asset.findOne({
      _id: req.params.assetId,
      owner: req.user!.id,
    });

    if (!asset) {
      return res
        .status(404)
        .json({ message: 'Asset not found or unauthorized' });
    }

    const stream = await getAssetStream(asset.key);

    // Set proper headers so the browser initiates a download instead of trying to render raw bytes
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Length', asset.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asset.originalFilename.replace(/["\r\n]/g, '_')}"`
    );

    // Efficiently pipe the data from the storage bucket to the client without loading it into server memory
    await pipeline(stream, res);
  } catch (error) {
    next(error);
  }
}

export async function getUserAssets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const kind = req.query.kind as string | undefined;
    const projectId = req.query.projectId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { owner: req.user!.id };
    if (kind) query.kind = kind;
    if (projectId && isValidObjectId(projectId)) query.project = projectId;

    const [assets, total] = await Promise.all([
      Asset.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Asset.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAssetController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { assetId } = req.params;
    if (!isValidObjectId(assetId)) {
      return res.status(400).json({ success: false, message: 'Invalid asset ID format' });
    }

    const asset = await Asset.findOneAndDelete({
      _id: assetId,
      owner: req.user!.id,
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const { deleteAsset: deleteFromStorage } = await import('../../../core/services/storage.service.ts');
    await deleteFromStorage(asset.key).catch(() => undefined);

    return res.status(200).json({ success: true, message: 'Asset deleted successfully' });
  } catch (error) {
    next(error);
  }
}
