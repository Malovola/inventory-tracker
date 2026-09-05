import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.issues) {
        res.status(400).json({
          error: 'Validation failed',
          details: (error.issues || []).map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      console.error('Body validation error:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      Object.defineProperty(req, 'query', {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError || error?.issues) {
        res.status(400).json({
          error: 'Query validation failed',
          details: (error.issues || []).map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      console.error('Query validation error:', error);
      res.status(400).json({ error: 'Invalid query parameters' });
    }
  };
}
