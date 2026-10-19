import { z } from 'zod';

export const createItemSchema = z.object({
  business_id: z.string().uuid().optional(),
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU too long'),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1, 'Product name is required').max(255, 'Product name too long'),
  category: z.string().max(100).optional().nullable(),
  unit_cost_default: z.coerce.number().min(0, 'Unit cost must be non-negative').default(0),
  min_stock_level: z.coerce.number().int().min(0).default(5),
});

export const updateItemSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50, 'SKU too long').optional(),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1, 'Product name is required').max(255, 'Product name too long').optional(),
  category: z.string().max(100).optional().nullable(),
  unit_cost_default: z.coerce.number().min(0, 'Unit cost must be non-negative').optional(),
  min_stock_level: z.coerce.number().int().min(0).optional(),
});

export const listItemsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(50),
  search: z.string().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
