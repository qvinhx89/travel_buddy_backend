import { z } from 'zod';

import { HttpError } from '../../utils/http-error';

const datetimeString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid datetime',
});

export const tripStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'interrupted', 'deleted']);

export const syncTripMetadataSchema = z.object({
  localTripId: z.string().min(1, 'localTripId is required'),
  name: z.string().min(1, 'Trip name is required').max(255),
  description: z.string().optional().nullable(),
  status: tripStatusSchema.default('completed'),
  startedAt: datetimeString,
  endedAt: datetimeString.optional().nullable(),
  durationSeconds: z.coerce.number().int().min(0).default(0),
  totalDistanceMeters: z.coerce.number().min(0).default(0),
  avgSpeedMps: z.coerce.number().min(0).default(0),
  maxSpeedMps: z.coerce.number().min(0).default(0),
  minElevationMeters: z.coerce.number().optional().nullable(),
  maxElevationMeters: z.coerce.number().optional().nullable(),
  startLat: z.coerce.number().min(-90).max(90).optional().nullable(),
  startLng: z.coerce.number().min(-180).max(180).optional().nullable(),
  endLat: z.coerce.number().min(-90).max(90).optional().nullable(),
  endLng: z.coerce.number().min(-180).max(180).optional().nullable(),
  pointCount: z.coerce.number().int().min(0).default(0),
});

export type SyncTripMetadata = z.infer<typeof syncTripMetadataSchema>;

export function parseSyncTripMetadata(raw: unknown) {
  if (typeof raw !== 'string') {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Validation error', [
      { field: 'metadata', message: 'metadata must be a stringified JSON object' },
    ]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Validation error', [
      { field: 'metadata', message: 'metadata must be valid JSON' },
    ]);
  }

  return syncTripMetadataSchema.parse(parsed);
}
