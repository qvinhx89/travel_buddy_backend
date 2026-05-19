import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { corsOrigins } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { syncRouter } from './modules/sync/sync.routes';
import { tripsRouter } from './modules/trips/trips.routes';
import { usersRouter } from './modules/users/users.routes';
import { sendSuccess } from './utils/response';

export const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigins }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  sendSuccess(res, 'Server healthy', { status: 'ok' });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1', usersRouter);
app.use('/api/v1/sync', syncRouter);
app.use('/api/v1/trips', tripsRouter);

app.use(notFoundHandler);
app.use(errorHandler);
