import type { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T,
  statusCode = 200,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  code: string,
  details: unknown[] = [],
) {
  return res.status(statusCode).json({
    success: false,
    message,
    error: {
      code,
      details,
    },
  });
}
