import { Request, Response, NextFunction } from 'express';
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
