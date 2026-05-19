import path from 'path';
import type { Request, Response } from 'express';

import { sendSuccess } from '../../utils/response';
import { deleteTrip, getTripDetail, getTripTrackFile, listTrips } from './trips.service';

export async function listTripsController(req: Request, res: Response) {
  const data = await listTrips(req.user!.id, req.query as any);
  sendSuccess(res, 'Trips fetched', data);
}

export async function getTripController(req: Request, res: Response) {
  const data = await getTripDetail(req.user!.id, req.params.tripId);
  sendSuccess(res, 'Trip detail fetched', data);
}

export async function getTripTrackController(req: Request, res: Response) {
  const file = await getTripTrackFile(req.user!.id, req.params.tripId);
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Content-Disposition', 'attachment; filename="track.jsonl"');
  res.sendFile(path.resolve(file.filePath));
}

export async function deleteTripController(req: Request, res: Response) {
  await deleteTrip(req.user!.id, req.params.tripId);
  sendSuccess(res, 'Trip deleted', null);
}
