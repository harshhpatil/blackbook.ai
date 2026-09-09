// Exporting the controllers from the auth folder for use in the routes file

export { login } from './login.controller.ts';
export { register, verifyEmail } from './account.controller.ts';
export {
  refreshToken,
  logout,
  getSessions,
  logoutSession,
  logoutAllSessions,
} from './session.controller.ts';
export {
  changePassword,
  forgotPassword,
  resetPassword,
} from './password.controller.ts';
export { googleLogin } from './oauth.controller.ts';
export { sendOtpHandler, verifyOtpHandler } from './sms.controller.ts';

