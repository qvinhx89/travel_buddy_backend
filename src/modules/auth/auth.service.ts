import { OAuth2Client } from 'google-auth-library';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import type { GoogleLoginInput } from './auth.validation';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function createAccessToken(userId: string) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

export async function loginWithGoogle(input: GoogleLoginInput) {
  const ticket = await googleClient.verifyIdToken({
    idToken: input.idToken,
    audience: env.GOOGLE_CLIENT_ID,
  }).catch(() => {
    throw new HttpError(401, 'AUTH_INVALID_GOOGLE_TOKEN', 'Invalid Google ID token');
  });

  const payload = ticket.getPayload();
  const googleId = payload?.sub;
  const email = payload?.email;

  if (!googleId || !email) {
    throw new HttpError(401, 'AUTH_INVALID_GOOGLE_TOKEN', 'Google token payload is missing required fields');
  }

  const user = await prisma.user.upsert({
    where: { googleId },
    create: {
      googleId,
      email,
      name: payload.name ?? email,
      avatarUrl: payload.picture,
    },
    update: {
      email,
      name: payload.name ?? email,
      avatarUrl: payload.picture,
    },
    select: { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true },
  });

  return {
    accessToken: createAccessToken(user.id),
    user,
  };
}
