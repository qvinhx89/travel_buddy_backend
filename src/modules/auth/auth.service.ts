import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import type { GoogleLoginInput, LogoutInput, RefreshTokenInput } from './auth.validation';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
const USER_SELECT = { id: true, email: true, name: true, avatarUrl: true, createdAt: true, updatedAt: true } as const;

type RefreshJwtPayload = jwt.JwtPayload & {
  sub: string;
  jti: string;
};

function createAccessToken(userId: string) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: userId,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function decodeRefreshToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshJwtPayload;
    if (!payload.sub || !payload.jti || !payload.exp) {
      throw new HttpError(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }
    return payload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, 'AUTH_REFRESH_EXPIRED', 'Refresh token expired');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new HttpError(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Invalid refresh token');
    }

    throw error;
  }
}

async function issueRefreshToken(userId: string) {
  const jti = crypto.randomUUID();
  const refreshToken = jwt.sign({ jti }, env.JWT_REFRESH_SECRET, {
    subject: userId,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
  const payload = jwt.decode(refreshToken) as jwt.JwtPayload | null;
  const expiresAt = payload?.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    },
  });

  return refreshToken;
}

async function createTokenPair(userId: string) {
  const [accessToken, refreshToken] = await Promise.all([
    Promise.resolve(createAccessToken(userId)),
    issueRefreshToken(userId),
  ]);
  return { accessToken, refreshToken };
}

export async function loginWithGoogle(input: GoogleLoginInput) {
  const ticket = await googleClient.verifyIdToken({
    idToken: input.idToken,
    audience: env.GOOGLE_CLIENT_ID,
  }).catch((error: unknown) => {
    const details =
      env.NODE_ENV === 'development' && error instanceof Error
        ? { message: error.message }
        : undefined;

    throw new HttpError(401, 'AUTH_INVALID_GOOGLE_TOKEN', 'Invalid Google ID token', details);
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
    select: USER_SELECT,
  });

  const tokens = await createTokenPair(user.id);

  return {
    ...tokens,
    user,
  };
}

export async function refreshAuth(input: RefreshTokenInput) {
  const payload = decodeRefreshToken(input.refreshToken);
  const tokenHash = hashToken(input.refreshToken);

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: USER_SELECT,
      },
    },
  });

  if (!stored || stored.userId !== payload.sub || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count !== 1) {
    throw new HttpError(401, 'AUTH_INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const tokens = await createTokenPair(stored.userId);

  return {
    ...tokens,
    user: stored.user,
  };
}

export async function logout(input: LogoutInput) {
  if (!input.refreshToken) return;

  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(input.refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
