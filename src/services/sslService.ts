import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';
import { getAvailableNetworkIps } from './networkService';

export interface SslCredentials {
  key: string;
  cert: string;
}

const CERT_DIR = path.join(process.cwd(), '.cert');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

/**
 * Ensures a valid SSL certificate exists for local and LAN network access.
 * If not already created, generates a self-signed certificate with all active LAN IPs.
 */
export async function getOrCreateSslCredentials(): Promise<SslCredentials> {
  // If already generated, return cached files
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    try {
      const key = fs.readFileSync(KEY_PATH, 'utf8');
      const cert = fs.readFileSync(CERT_PATH, 'utf8');
      if (key && cert) {
        return { key, cert };
      }
    } catch (err) {
      console.warn('⚠️ Could not read existing SSL cert, regenerating...', err);
    }
  }

  // Ensure directory exists
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
  }

  console.log('🔐 Generating self-signed SSL certificate for mobile camera terminal HTTPS...');

  const ips = getAvailableNetworkIps();
  const altNames: Array<{ type: number; value?: string; ip?: string }> = [
    { type: 2, value: 'localhost' },
    { type: 7, ip: '127.0.0.1' },
  ];

  for (const entry of ips) {
    altNames.push({ type: 7, ip: entry.ip });
  }

  const attrs = [{ name: 'commonName', value: 'NexTrack Local Dev SSL' }];
  const options = {
    days: 365,
    keySize: 2048,
    extensions: [{ name: 'subjectAltName', altNames }],
  };

  const pems: any = await (selfsigned as any).generate(attrs, options);
  const key = pems.private;
  const cert = pems.cert;

  fs.writeFileSync(KEY_PATH, key, 'utf8');
  fs.writeFileSync(CERT_PATH, cert, 'utf8');

  console.log('✅ SSL certificate generated successfully in .cert/');
  return { key, cert };
}
