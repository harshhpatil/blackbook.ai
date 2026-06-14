// exporting the controllers from the auth folder for use in other parts of the application

export { login } from './auth/login.controller.js';
export {
  register,
  welcomeEmail,
  verifyEmail,
} from './auth/account.controller.js';
export {
  refreshToken,
  logout,
  getSessions,
  logoutSession,
  logoutAllSessions,
} from './auth/session.controller.js';
export {
  changePassword,
  forgotPassword,
  resetPassword,
} from './auth/password.controller.js';
