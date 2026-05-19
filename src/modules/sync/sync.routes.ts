import path from 'path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';

import { env } from '../../config/env';
import { requireAuth } from '../../middlewares/auth.middleware';
import { HttpError } from '../../utils/http-error';
import { asyncHandler } from '../../utils/async-handler';
import { syncTripController } from './sync.controller';

export const syncRouter = Router();

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.jsonl' || ext === '.txt') {
      cb(null, true);
      return;
    }

    cb(new HttpError(400, 'FILE_INVALID_TYPE', 'Only .jsonl or .txt track files are accepted'));
  },
});

syncRouter.post(
  '/trips',
  requireAuth,
  syncLimiter,
  upload.single('trackFile'),
  asyncHandler(syncTripController),
);
