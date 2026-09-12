import path from 'node:path';
import { User, IUser } from '../../authentication_module/models/Users.model.ts';
import { Session } from '../../authentication_module/models/Session.model.ts';
import { Project } from '../../project_module/models/Project.model.ts';
import { Asset } from '../../assets_module/models/Asset.model.ts';
import {
  createAssetKey,
  deleteAsset,
  uploadAsset,
} from '../../../core/services/storage.service.ts';
import { createLogger } from '../../../core/lib/logger.ts';
import { env } from '../../../core/config/env.ts';

const log = createLogger('profile-service');

export async function getUserProfile(userId: string): Promise<Partial<IUser>> {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) throw new Error('User not found');
  return user.toObject();
}

export async function updateUserProfile(
  userId: string,
  updateData: {
    name?: string;
    company?: string;
    bio?: string;
    timezone?: string;
    collegeName?: string;
    branch?: string;
    guideName?: string;
  }
): Promise<Partial<IUser>> {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('-passwordHash');

  if (!user) throw new Error('User not found');
  log.info({ userId }, 'User profile updated');
  return user.toObject();
}

export async function uploadUserAvatar(
  userId: string,
  file: Express.Multer.File
): Promise<string> {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const extension = path.extname(file.originalname).toLowerCase() || '.png';
  const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
  if (!allowed.includes(extension)) {
    throw new Error('Invalid image format. Allowed: png, jpg, jpeg, webp');
  }

  const key = createAssetKey(userId, 'avatar', extension);
  await uploadAsset(key, file.buffer, file.mimetype);
  const avatarUrl = env.R2_PUBLIC_DOMAIN
    ? `${env.R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${key}`
    : key;

  user.avatarUrl = avatarUrl;
  await user.save();

  log.info({ userId, avatarUrl }, 'User avatar uploaded successfully');
  return avatarUrl;
}

export async function exportUserData(userId: string) {
  const [user, projects, assets, sessions] = await Promise.all([
    User.findById(userId).select('-passwordHash').lean(),
    Project.find({ userId }).lean(),
    Asset.find({ owner: userId }).select('-key').lean(),
    Session.find({ user: userId }).select('-tokenHash').lean(),
  ]);

  if (!user) throw new Error('User not found');

  return {
    exportTimestamp: new Date().toISOString(),
    profile: user,
    projects,
    assets,
    activeSessions: sessions,
  };
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Delete all user assets from R2 storage
  const userAssets = await Asset.find({ owner: userId });
  for (const asset of userAssets) {
    await deleteAsset(asset.key).catch(() => undefined);
  }

  // Delete DB records
  await Promise.all([
    Asset.deleteMany({ owner: userId }),
    Project.deleteMany({ userId }),
    Session.deleteMany({ user: userId }),
    User.findByIdAndDelete(userId),
  ]);

  log.info({ userId }, 'User account and associated data deleted successfully');
}
