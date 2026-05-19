import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { meController } from './users.controller';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, asyncHandler(meController));
