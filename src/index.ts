import http from 'http';
import https from 'https';
import { app } from './app';
import { config } from './config';
import { getOrCreateSslCredentials } from './services/sslService';
import { getPrimaryLanIp, getAvailableNetworkIps } from './services/networkService';

async function bootstrap() {
  const lanIp = getPrimaryLanIp();
  const allIps = getAvailableNetworkIps();

  // 1. Start HTTP Server
  const httpServer = http.createServer(app);
  httpServer.listen(config.PORT, '0.0.0.0', () => {
    console.log('\n======================================================');
    console.log('       NEXTRACK ENTERPRISE INVENTORY SERVER           ');
    console.log('======================================================');
    console.log(`🌐 Local HTTP:       http://localhost:${config.PORT}`);
    console.log(`📡 Network HTTP:     http://${lanIp}:${config.PORT}`);
  });

  // 2. Start HTTPS Server (for secure mobile camera scanning)
  let httpsServer: https.Server | null = null;
  if (config.ENABLE_HTTPS) {
    try {
      const credentials = await getOrCreateSslCredentials();
      httpsServer = https.createServer(credentials, app);
      httpsServer.listen(config.HTTPS_PORT, '0.0.0.0', () => {
        console.log(`🔒 Network HTTPS:    https://${lanIp}:${config.HTTPS_PORT} (Required for Phone Camera)`);
        console.log('======================================================');
        if (allIps.length > 1) {
          console.log('ℹ️ Additional network interfaces detected:');
          allIps.slice(1).forEach((entry) => {
            console.log(`   - ${entry.name}: https://${entry.ip}:${config.HTTPS_PORT}`);
          });
          console.log('======================================================\n');
        } else {
          console.log('');
        }
      });
    } catch (err) {
      console.error('⚠️ Could not initialize HTTPS server:', err);
    }
  }

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Shutdown signal received: closing servers gracefully...');
    httpServer.close(() => {
      console.log('HTTP server closed');
      if (httpsServer) {
        httpsServer.close(() => {
          console.log('HTTPS server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
