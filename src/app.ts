import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

import { config } from './config';

import { authRouter } from './routes/auth';
import { itemsRouter } from './routes/items';
import { eventsRouter } from './routes/events';
import { stockRouter } from './routes/stock';
import { dashboardRouter } from './routes/dashboard';
import { systemRouter } from './routes/system';

export const app = express();

// 1. Security Headers
const isDevelopment = config.NODE_ENV !== 'production';

app.use(
  helmet({
    contentSecurityPolicy: isDevelopment
      ? false
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net'],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.tailwindcss.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
            connectSrc: ["'self'", 'http:', 'https:'],
          },
        },
    ...(isDevelopment ? { strictTransportSecurity: false } : {}),
  })
);

// 2. CORS configuration (supports HTTP and HTTPS LAN connections)
const allowedOrigin = config.FRONTEND_ORIGIN;
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        isDevelopment ||
        origin === allowedOrigin ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('https://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('https://127.0.0.1:') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('https://192.168.') ||
        origin.startsWith('http://10.') ||
        origin.startsWith('https://10.') ||
        origin.startsWith('http://172.') ||
        origin.startsWith('https://172.')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

// 3. Rate Limiting (15 minutes, 200 requests)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' },
});
app.use('/api/', limiter);

// 4. Body parsers with size limit
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 5. Static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// 6. API Routes
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/items', itemsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/stock', stockRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/system', systemRouter);

// 7. 404 handler for API routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// 8. Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
