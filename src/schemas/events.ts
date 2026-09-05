import { z } from 'zod';

const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uuidSchema = z.string().regex(uuidPattern, 'Invalid UUID format');

export const createEventSchema = z.object({
  item_id: uuidSchema,
  store_id: uuidSchema,
  business_id: uuidSchema.optional(),
  event_type: z.enum(['RESTOCK', 'SALE', 'ADJUSTMENT', 'RETURN', 'WASTE']),
  quantity: z.coerce.number().int(),
  unit_price: z.coerce.number().min(0).default(0),
  note: z.string().max(500).optional().nullable(),
  source: z.enum(['MANUAL', 'CAMERA_SCAN', 'HID_SCANNER', 'POS_WEBHOOK', 'CSV_IMPORT']).default('MANUAL'),
});

export const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  item_id: uuidSchema.optional(),
  store_id: uuidSchema.optional(),
  event_type: z.enum(['RESTOCK', 'SALE', 'ADJUSTMENT', 'RETURN', 'WASTE']).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
