import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/response';
import { parseSyncTripMetadata } from './sync.validation';
import { syncTripWithTrackFile } from './sync.service';

export async function syncTripController(req: Request, res: Response) {
  const metadata = parseSyncTripMetadata(req.body.metadata);
  const data = await syncTripWithTrackFile(
    req.user!.id,
    metadata,
    req.file,
    req.header('X-Request-Id') ?? undefined,
  );

  sendSuccess(res, 'Trip synced successfully', data, 201);
}
