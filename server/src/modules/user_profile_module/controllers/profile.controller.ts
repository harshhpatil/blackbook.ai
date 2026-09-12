import { Request, Response, NextFunction } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  uploadUserAvatar,
  exportUserData,
  deleteUserAccount,
} from '../services/profile.service.ts';
import { recordAudit } from '../../authentication_module/utils/auth.helpers.ts';

export async function getProfileController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const profile = await getUserProfile(req.user!.id);
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    next(error);
  }
}

export async function updateProfileController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const profile = await updateUserProfile(req.user!.id, req.body);
    await recordAudit({
      user: req.user!.id,
      event: 'profile_updated',
      req,
    });
    return res.status(200).json({ success: true, profile });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatarController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file uploaded' });
    }

    const avatarUrl = await uploadUserAvatar(req.user!.id, req.file);
    return res.status(200).json({ success: true, avatarUrl });
  } catch (error) {
    next(error);
  }
}

export async function exportDataController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await exportUserData(req.user!.id);
    await recordAudit({
      user: req.user!.id,
      event: 'user_data_exported',
      req,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteAccountController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await deleteUserAccount(req.user!.id);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return res.status(200).json({
      success: true,
      message: 'Account and associated data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
