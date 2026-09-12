import { Request, Response, NextFunction } from 'express';
import { sendOtp, verifyOtp } from '../services/otp.service.ts';
import { User } from '../models/Users.model.ts';
import { AuthError } from '../utils/auth.helpers.ts';

/**
 * @function sendOtpHandler
 * @description Triggers the OTP sending process to a given mobile number
 * @route POST /api/v1/auth/send-otp
 */
export async function sendOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { mobileNumber } = req.body;

    // Send the OTP
    await sendOtp(mobileNumber);

    return res.status(200).json({
      message: 'OTP has been sent to your mobile number successfully.',
    });
  } catch (err) {
    next(new AuthError('Failed to send OTP. Please try again later.', 500));
  }
}

/**
 * @function verifyOtpHandler
 * @description Verifies the submitted OTP and updates the user's isMobileVerified status
 * @route POST /api/v1/auth/verify-otp
 */
export async function verifyOtpHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const { mobileNumber, otp } = req.body;

    // Verify the OTP via the service
    const isValid = await verifyOtp(mobileNumber, otp);

    if (!isValid) {
      throw new AuthError('Invalid or expired OTP', 400);
    }

    // Update the user's isMobileVerified field in the database
    const user = await User.findOneAndUpdate(
      { mobileNumber },
      { $set: { isMobileVerified: true } },
      { new: true }
    );

    if (!user) {
      // If user does not exist with this mobile number
      throw new AuthError('No user found with this mobile number', 404);
    }

    return res.status(200).json({
      message: 'Mobile number verified successfully!',
    });
  } catch (err) {
    next(err);
  }
}
