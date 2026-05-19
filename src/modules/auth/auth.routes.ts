import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { asyncHandler } from '../../utils/async-handler';
import { validate } from '../../middlewares/validate.middleware';
import { googleLoginController } from './auth.controller';
import { googleLoginSchema } from './auth.validation';

export const authRouter = Router();

const googleAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.post(
  '/google',
  googleAuthLimiter,
  validate({ body: googleLoginSchema }),
  asyncHandler(googleLoginController),
);
