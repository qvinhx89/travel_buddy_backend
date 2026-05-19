import { Router } from 'express';

import { requireAuth } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { asyncHandler } from '../../utils/async-handler';
import {
  deleteTripController,
  getTripController,
  getTripTrackController,
  listTripsController,
} from './trips.controller';
import { listTripsQuerySchema, tripIdParamsSchema } from './trips.validation';

export const tripsRouter = Router();

tripsRouter.use(requireAuth);

tripsRouter.get('/', validate({ query: listTripsQuerySchema }), asyncHandler(listTripsController));
tripsRouter.get('/:tripId', validate({ params: tripIdParamsSchema }), asyncHandler(getTripController));
tripsRouter.get(
  '/:tripId/track',
  validate({ params: tripIdParamsSchema }),
  asyncHandler(getTripTrackController),
);
tripsRouter.delete('/:tripId', validate({ params: tripIdParamsSchema }), asyncHandler(deleteTripController));
