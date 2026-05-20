import type { Prisma, TripFile } from '@prisma/client';

import { prisma } from '../../config/database';
import { HttpError } from '../../utils/http-error';
import type { ListTripsQuery } from './trips.validation';

function serializeBigInt(value: bigint) {
  return Number(value);
}

function toFileDto(file: TripFile) {
  return {
    id: file.id,
    fileType: file.fileType,
    originalFilename: file.originalFilename,
    sizeBytes: serializeBigInt(file.sizeBytes),
    checksumSha256: file.checksumSha256,
    uploadedAt: file.uploadedAt,
    createdAt: file.createdAt,
  };
}

export async function listTrips(userId: string, query: ListTripsQuery) {
  const where: Prisma.TripWhereInput = {
    userId,
    status: query.status ?? { not: 'deleted' },
    ...(query.syncStatus ? { syncStatus: query.syncStatus } : {}),
    ...(query.search ? { name: { contains: query.search } } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: { files: { select: { id: true } } },
    }),
    prisma.trip.count({ where }),
  ]);

  return {
    items: items.map((trip) => ({
      id: trip.id,
      localTripId: trip.localTripId,
      name: trip.name,
      status: trip.status,
      travelMode: trip.travelMode,
      offlineRegionId: trip.offlineRegionId,
      startedAt: trip.startedAt,
      endedAt: trip.endedAt,
      durationSeconds: trip.durationSeconds,
      totalDistanceMeters: trip.totalDistanceMeters,
      avgSpeedMps: trip.avgSpeedMps,
      maxSpeedMps: trip.maxSpeedMps,
      pointCount: trip.pointCount,
      syncStatus: trip.syncStatus,
      hasTrackFile: trip.files.length > 0,
      createdAt: trip.createdAt,
      updatedAt: trip.updatedAt,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getTripDetail(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId, status: { not: 'deleted' } },
    include: { files: true },
  });

  if (!trip) {
    throw new HttpError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  }

  return {
    id: trip.id,
    localTripId: trip.localTripId,
    name: trip.name,
    description: trip.description,
    status: trip.status,
    travelMode: trip.travelMode,
    offlineRegionId: trip.offlineRegionId,
    startedAt: trip.startedAt,
    endedAt: trip.endedAt,
    durationSeconds: trip.durationSeconds,
    totalDistanceMeters: trip.totalDistanceMeters,
    avgSpeedMps: trip.avgSpeedMps,
    maxSpeedMps: trip.maxSpeedMps,
    minElevationMeters: trip.minElevationMeters,
    maxElevationMeters: trip.maxElevationMeters,
    startLat: trip.startLat,
    startLng: trip.startLng,
    endLat: trip.endLat,
    endLng: trip.endLng,
    pointCount: trip.pointCount,
    syncStatus: trip.syncStatus,
    uploadedAt: trip.uploadedAt,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    files: trip.files.map(toFileDto),
  };
}

export async function getTripTrackFile(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId, status: { not: 'deleted' } },
    include: { files: { where: { fileType: 'raw_track_jsonl' }, take: 1 } },
  });

  if (!trip) {
    throw new HttpError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  }

  const file = trip.files[0];
  if (!file) {
    throw new HttpError(404, 'TRACK_FILE_NOT_FOUND', 'Track file not found');
  }

  return file;
}

export async function deleteTrip(userId: string, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId, status: { not: 'deleted' } },
    select: { id: true },
  });

  if (!trip) {
    throw new HttpError(404, 'TRIP_NOT_FOUND', 'Trip not found');
  }

  await prisma.trip.update({
    where: { id: tripId },
    data: { status: 'deleted' },
  });
}
