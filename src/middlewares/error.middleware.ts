import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';

import { env } from '../config/env';
import { HttpError } from '../utils/http-error';
import { sendError } from '../utils/response';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(new HttpError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) {
    const details = Array.isArray(error.details) ? error.details : error.details ? [error.details] : [];
    sendError(res, error.statusCode, error.message, error.code, details);
    return;
  }

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    sendError(res, 422, 'Validation error', 'VALIDATION_ERROR', details);
    return;
  }

  if (error instanceof multer.MulterError) {
    const code = error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED';
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : error.message;
    sendError(res, error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, message, code);
    return;
  }

  const details = env.NODE_ENV === 'development' && error instanceof Error ? [{ message: error.message }] : [];
  sendError(res, 500, 'Internal server error', 'INTERNAL_SERVER_ERROR', details);
}
