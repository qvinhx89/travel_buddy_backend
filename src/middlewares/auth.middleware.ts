import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { prisma } from '../config/database';
import { env } from '../config/env';
import { HttpError } from '../utils/http-error';

type JwtPayload = {
  sub: string;
};

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header('Authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

    if (!token) {
      throw new HttpError(401, 'AUTH_MISSING_TOKEN', 'Missing access token');
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    if (!payload.sub) {
      throw new HttpError(401, 'AUTH_INVALID_TOKEN', 'Invalid access token');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      throw new HttpError(401, 'USER_NOT_FOUND', 'User not found');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new HttpError(401, 'AUTH_EXPIRED_TOKEN', 'Access token expired'));
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(new HttpError(401, 'AUTH_INVALID_TOKEN', 'Invalid access token'));
      return;
    }

    next(error);
  }
}
