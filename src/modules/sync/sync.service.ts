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

type TrackPointEvent = {
  type: 'point';
  lat: number;
  lng: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
};

type TrackEvent =
  | TrackPointEvent
  | { type: 'start'; timestamp: number }
  | { type: 'pause'; timestamp: number }
  | { type: 'resume'; timestamp: number }
  | { type: 'finish'; timestamp: number };

type TrackSummary = {
  totalDistanceMeters: number;
  activeDurationSeconds: number;
  pointCount: number;
  maxSpeedMps: number;
  minElevationMeters: number | null;
  maxElevationMeters: number | null;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  routeCoordinates: [number, number][];
  eventCounts: {
    start: number;
    pause: number;
    resume: number;
    finish: number;
    point: number;
  };
};

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusMeters = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * radiusMeters * Math.asin(Math.sqrt(h));
}

function parseTrackLine(line: string): TrackEvent | null {
  try {
    const value = JSON.parse(line) as Record<string, unknown>;

    if (value.type === 'point' && typeof value.lat === 'number' && typeof value.lng === 'number') {
      return value as TrackPointEvent;
    }

    if (
      typeof value.latitude === 'number' &&
      typeof value.longitude === 'number' &&
      typeof value.timestamp === 'number'
    ) {
      return {
        type: 'point',
        lat: value.latitude,
        lng: value.longitude,
        altitude: typeof value.altitude === 'number' ? value.altitude : null,
        speed: typeof value.speedKmh === 'number' ? value.speedKmh / 3.6 : null,
        heading: typeof value.heading === 'number' ? value.heading : null,
        timestamp: value.timestamp,
      };
    }

    if (
      (value.type === 'start' || value.type === 'pause' || value.type === 'resume' || value.type === 'finish') &&
      typeof value.timestamp === 'number'
    ) {
      return value as TrackEvent;
    }

    return null;
  } catch {
    return null;
  }
}

function parseTrackEvents(buffer: Buffer): TrackEvent[] {
  return buffer
    .toString('utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseTrackLine)
    .filter((event): event is TrackEvent => Boolean(event));
}

function computeTrackSummary(events: TrackEvent[]): TrackSummary {
  let totalDistanceMeters = 0;
  let activeDurationMs = 0;
  let maxSpeedMps = 0;
  let minElevationMeters: number | null = null;
  let maxElevationMeters: number | null = null;
  let active = true;
  let activeStartedAt: number | null = null;
  let lastPoint: TrackPointEvent | null = null;
  let pointCount = 0;
  let startLat: number | null = null;
  let startLng: number | null = null;
  let endLat: number | null = null;
  let endLng: number | null = null;
  const routeCoordinates: [number, number][] = [];
  const eventCounts = {
    start: 0,
    pause: 0,
    resume: 0,
    finish: 0,
    point: 0,
  };

  for (const event of events) {
    if (event.type === 'start' || event.type === 'resume') {
      eventCounts[event.type] += 1;
      active = true;
      activeStartedAt = event.timestamp;
      lastPoint = null;
      continue;
    }

    if (event.type === 'pause' || event.type === 'finish') {
      eventCounts[event.type] += 1;
      if (active && activeStartedAt !== null) {
        activeDurationMs += Math.max(0, event.timestamp - activeStartedAt);
      }
      active = false;
      activeStartedAt = null;
      lastPoint = null;
      continue;
    }

    if (!active) continue;

    if (activeStartedAt === null) activeStartedAt = event.timestamp;
    eventCounts.point += 1;

    if (lastPoint) {
      totalDistanceMeters += haversineMeters(
        { lat: lastPoint.lat, lng: lastPoint.lng },
        { lat: event.lat, lng: event.lng },
      );
    }

    lastPoint = event;
    pointCount += 1;
    routeCoordinates.push([event.lng, event.lat]);

    if (startLat === null || startLng === null) {
      startLat = event.lat;
      startLng = event.lng;
    }
    endLat = event.lat;
    endLng = event.lng;

    if (typeof event.speed === 'number') {
      maxSpeedMps = Math.max(maxSpeedMps, Math.max(0, event.speed));
    }

    if (typeof event.altitude === 'number') {
      minElevationMeters = minElevationMeters === null ? event.altitude : Math.min(minElevationMeters, event.altitude);
      maxElevationMeters = maxElevationMeters === null ? event.altitude : Math.max(maxElevationMeters, event.altitude);
    }
  }

  if (active && activeStartedAt !== null && lastPoint) {
    activeDurationMs += Math.max(0, lastPoint.timestamp - activeStartedAt);
  }

  return {
    totalDistanceMeters,
    activeDurationSeconds: Math.round(activeDurationMs / 1000),
    pointCount,
    maxSpeedMps,
    minElevationMeters,
    maxElevationMeters,
    startLat,
    startLng,
    endLat,
    endLng,
    routeCoordinates,
    eventCounts,
  };
}

function verifyTrackSummary(metadata: SyncTripMetadata, summary: TrackSummary) {
  const hasSummary = summary.pointCount > 0 || summary.activeDurationSeconds > 0;
  if (!hasSummary) return { isMatch: true, mismatches: [] as string[] };

  const mismatches: string[] = [];
  const distanceTolerance = Math.max(25, metadata.totalDistanceMeters * 0.05);
  const durationTolerance = Math.max(15, metadata.durationSeconds * 0.05);

  if (Math.abs(metadata.totalDistanceMeters - summary.totalDistanceMeters) > distanceTolerance) {
    mismatches.push('totalDistanceMeters');
  }

  if (Math.abs(metadata.durationSeconds - summary.activeDurationSeconds) > durationTolerance) {
    mismatches.push('durationSeconds');
  }

  if (metadata.pointCount !== summary.pointCount) {
    mismatches.push('pointCount');
  }

  return { isMatch: mismatches.length === 0, mismatches };
}

function mergeTripStats(metadata: SyncTripMetadata, summary: TrackSummary) {
  const hasSummary = summary.pointCount > 0 || summary.activeDurationSeconds > 0;
  const durationSeconds = hasSummary ? summary.activeDurationSeconds : metadata.durationSeconds;
  const totalDistanceMeters = hasSummary ? summary.totalDistanceMeters : metadata.totalDistanceMeters;
  const pointCount = hasSummary ? summary.pointCount : metadata.pointCount;
  const maxSpeedMps = hasSummary ? summary.maxSpeedMps : metadata.maxSpeedMps;
  const minElevationMeters = summary.minElevationMeters ?? metadata.minElevationMeters ?? null;
  const maxElevationMeters = summary.maxElevationMeters ?? metadata.maxElevationMeters ?? null;
  const startLat = summary.startLat ?? metadata.startLat ?? null;
  const startLng = summary.startLng ?? metadata.startLng ?? null;
  const endLat = summary.endLat ?? metadata.endLat ?? null;
  const endLng = summary.endLng ?? metadata.endLng ?? null;
  const avgSpeedMps = durationSeconds > 0 ? totalDistanceMeters / durationSeconds : 0;

  return {
    durationSeconds,
    totalDistanceMeters,
    avgSpeedMps,
    maxSpeedMps,
    minElevationMeters,
    maxElevationMeters,
    startLat,
    startLng,
    endLat,
    endLng,
    pointCount,
  };
}

function simplifyRouteCoordinates(
  coordinates: [number, number][],
  maxPoints = 2000,
) {
  if (coordinates.length <= maxPoints) return coordinates;
  const step = Math.max(1, Math.floor(coordinates.length / maxPoints));
  const simplified: [number, number][] = [];
  for (let i = 0; i < coordinates.length; i += step) {
    simplified.push(coordinates[i]);
  }
  const last = coordinates[coordinates.length - 1];
  const final = simplified[simplified.length - 1];
  if (!final || final[0] !== last[0] || final[1] !== last[1]) {
    simplified.push(last);
  }
  return simplified;
}

function buildSimplifiedGeoJson(summary: TrackSummary) {
  const simplified = simplifyRouteCoordinates(summary.routeCoordinates);
  return {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'LineString' as const,
          coordinates: simplified,
        },
        properties: {
          source: 'track.jsonl',
          pointCountRaw: summary.routeCoordinates.length,
          pointCountSimplified: simplified.length,
          totalDistanceMeters: summary.totalDistanceMeters,
          activeDurationSeconds: summary.activeDurationSeconds,
        },
      },
    ],
  };
}

async function writeVerificationArtifacts(
  uploadDir: string,
  metadata: SyncTripMetadata,
  summary: TrackSummary,
  mismatches: string[],
) {
  const simplifiedGeoJson = buildSimplifiedGeoJson(summary);
  const geoJsonContent = JSON.stringify(simplifiedGeoJson);
  const geoJsonPath = path.join(uploadDir, 'track.simplified.geojson');
  await fs.writeFile(geoJsonPath, geoJsonContent, 'utf-8');

  const verificationReport = {
    generatedAt: new Date().toISOString(),
    metadata: {
      localTripId: metadata.localTripId,
      durationSeconds: metadata.durationSeconds,
      totalDistanceMeters: metadata.totalDistanceMeters,
      pointCount: metadata.pointCount,
    },
    recomputed: {
      activeDurationSeconds: summary.activeDurationSeconds,
      totalDistanceMeters: summary.totalDistanceMeters,
      pointCount: summary.pointCount,
      maxSpeedMps: summary.maxSpeedMps,
      minElevationMeters: summary.minElevationMeters,
      maxElevationMeters: summary.maxElevationMeters,
      eventCounts: summary.eventCounts,
    },
    verification: {
      isMatch: mismatches.length === 0,
      mismatches,
    },
  };
  const verificationPath = path.join(uploadDir, 'track.verification.json');
  await fs.writeFile(verificationPath, JSON.stringify(verificationReport, null, 2), 'utf-8');

  return {
    geoJsonPath,
    geoJsonChecksumSha256: crypto.createHash('sha256').update(geoJsonContent).digest('hex'),
    geoJsonSizeBytes: Buffer.byteLength(geoJsonContent, 'utf-8'),
  };
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

  const events = parseTrackEvents(file.buffer);
  const summary = computeTrackSummary(events);
  const verification = verifyTrackSummary(metadata, summary);
  if (!verification.isMatch) {
    console.warn('Track verification mismatch', {
      userId,
      localTripId: metadata.localTripId,
      mismatches: verification.mismatches,
    });
  }

  const verifiedStats = mergeTripStats(metadata, summary);

  const now = new Date();
  const tripData = {
    name: metadata.name,
    description: metadata.description ?? null,
    status: metadata.status,
    travelMode: metadata.travelMode,
    offlineRegionId: metadata.offlineRegionId ?? null,
    startedAt: new Date(metadata.startedAt),
    endedAt: dateOrNull(metadata.endedAt),
    durationSeconds: verifiedStats.durationSeconds,
    totalDistanceMeters: verifiedStats.totalDistanceMeters,
    avgSpeedMps: verifiedStats.avgSpeedMps,
    maxSpeedMps: verifiedStats.maxSpeedMps,
    minElevationMeters: numberOrNull(verifiedStats.minElevationMeters),
    maxElevationMeters: numberOrNull(verifiedStats.maxElevationMeters),
    startLat: numberOrNull(verifiedStats.startLat),
    startLng: numberOrNull(verifiedStats.startLng),
    endLat: numberOrNull(verifiedStats.endLat),
    endLng: numberOrNull(verifiedStats.endLng),
    pointCount: verifiedStats.pointCount,
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
    const artifacts = await writeVerificationArtifacts(uploadDir, metadata, summary, verification.mismatches);

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

    await prisma.tripFile.upsert({
      where: {
        tripId_fileType: {
          tripId: trip.id,
          fileType: 'processed_geojson',
        },
      },
      create: {
        tripId: trip.id,
        fileType: 'processed_geojson',
        originalFilename: 'track.simplified.geojson',
        storedFilename: 'track.simplified.geojson',
        filePath: artifacts.geoJsonPath,
        mimeType: 'application/geo+json',
        sizeBytes: BigInt(artifacts.geoJsonSizeBytes),
        checksumSha256: artifacts.geoJsonChecksumSha256,
        uploadedAt: now,
      },
      update: {
        originalFilename: 'track.simplified.geojson',
        storedFilename: 'track.simplified.geojson',
        filePath: artifacts.geoJsonPath,
        mimeType: 'application/geo+json',
        sizeBytes: BigInt(artifacts.geoJsonSizeBytes),
        checksumSha256: artifacts.geoJsonChecksumSha256,
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
