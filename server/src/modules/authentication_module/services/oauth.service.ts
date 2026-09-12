import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/Users.model.ts';
import { env } from '../../../core/config/env.ts';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export const verifyGoogleTokenAndUpsertUser = async (token: string) => {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email)
    throw new Error('Invalid Google token payload');

  let user = await User.findOne({
    $or: [{ googleId: payload.sub }, { email: payload.email }],
  });

  if (!user) {
    user = await User.create({
      email: payload.email,
      name: payload.name,
      authProvider: 'google',
      googleId: payload.sub,
      isEmailVerified: payload.email_verified || false,
    });
  } else if (!user.googleId) {
    // Link Google account to existing local email account
    user.googleId = payload.sub;
    user.authProvider = 'google';
    await user.save();
  }

  return user;
};
