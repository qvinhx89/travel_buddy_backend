import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Express } from 'express';

import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { HttpError } from '../../utils/http-error';
import type { SyncTripMetadata } from './sync.validation';

function dateOrNull(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function numberOrNull(value: number | null | undefined) {
  return value ?? null;
}

export async function syncTripWithTrackFile(
  userId: string,
  metadata: SyncTripMetadata,
  file: Express.Multer.File | undefined,
  requestId?: string,
) {
  if (!file) {
    throw new HttpError(400, 'FILE_REQUIRED', 'trackFile is required');
  }

  const now = new Date();
  const tripData = {
    name: metadata.name,
    description: metadata.description ?? null,
    status: metadata.status,
    startedAt: new Date(metadata.startedAt),
    endedAt: dateOrNull(metadata.endedAt),
    durationSeconds: metadata.durationSeconds,
    totalDistanceMeters: metadata.totalDistanceMeters,
    avgSpeedMps: metadata.avgSpeedMps,
    maxSpeedMps: metadata.maxSpeedMps,
    minElevationMeters: numberOrNull(metadata.minElevationMeters),
    maxElevationMeters: numberOrNull(metadata.maxElevationMeters),
    startLat: numberOrNull(metadata.startLat),
    startLng: numberOrNull(metadata.startLng),
    endLat: numberOrNull(metadata.endLat),
    endLng: numberOrNull(metadata.endLng),
    pointCount: metadata.pointCount,
    syncStatus: 'synced' as const,
    uploadedAt: now,
  };

  try {
    const trip = await prisma.trip.upsert({
      where: {
        userId_localTripId: {
          userId,
          localTripId: metadata.localTripId,
        },
      },
      create: {
        userId,
        localTripId: metadata.localTripId,
        ...tripData,
      },
      update: tripData,
    });

    const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR, 'trips', userId, trip.id);
    await fs.mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, 'track.jsonl');
    await fs.writeFile(filePath, file.buffer);

    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');

    await prisma.tripFile.upsert({
      where: {
        tripId_fileType: {
          tripId: trip.id,
          fileType: 'raw_track_jsonl',
        },
      },
      create: {
        tripId: trip.id,
        fileType: 'raw_track_jsonl',
        originalFilename: file.originalname,
        storedFilename: 'track.jsonl',
        filePath,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        checksumSha256,
        uploadedAt: now,
      },
      update: {
        originalFilename: file.originalname,
        storedFilename: 'track.jsonl',
        filePath,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        checksumSha256,
        uploadedAt: now,
      },
    });

    await prisma.syncLog.create({
      data: {
        userId,
        tripId: trip.id,
        action: 'upload_trip',
        status: 'success',
        requestId,
      },
    });

    return {
      tripId: trip.id,
      localTripId: trip.localTripId,
      syncStatus: trip.syncStatus,
      uploadedAt: now,
    };
  } catch (error) {
    await prisma.syncLog.create({
      data: {
        userId,
        action: 'upload_trip',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        requestId,
      },
    }).catch(() => {});

    throw error;
  }
}
