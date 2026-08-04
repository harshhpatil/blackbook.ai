import { Router } from 'express';
import { pipeline } from 'node:stream/promises';
import { Asset } from '../models/Asset.model.ts';
import { authenticate } from '../middlewares/auth.middleware.ts';
import { getAssetStream } from '../services/storage.service.ts';

const router = Router();

router.get('/:assetId/download', authenticate, async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.assetId, owner: req.user.id });
    if (!asset) return res.status(404).json({ message: 'asset not found' });

    const stream = await getAssetStream(asset.key);
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Length', asset.size);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asset.originalFilename.replace(/["\\r\\n]/g, '_')}"`
    );
    await pipeline(stream, res);
  } catch (error) {
    next(error);
  }
});

export default router;
