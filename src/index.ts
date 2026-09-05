import { app } from './app';
import dotenv from 'dotenv';

dotenv.config();

const port = process.env.PORT || 3000;

const server = app.listen(port, () => {
  console.log(`NexTrack Server is running on http://localhost:${port}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
