import { z } from 'zod';

export const tripIdParamsSchema = z.object({
  tripId: z.string().min(1),
});

export const listTripsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'active', 'paused', 'completed', 'interrupted', 'deleted']).optional(),
  syncStatus: z.enum(['pending', 'syncing', 'synced', 'failed']).optional(),
  sortBy: z.enum(['startedAt', 'createdAt', 'updatedAt']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;
