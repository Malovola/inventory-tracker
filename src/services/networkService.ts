import os from 'os';
import { config } from '../config';
import { PairingInfoResponse } from '../types';

export interface LocalIpEntry {
  name: string;
  ip: string;
  isVirtual: boolean;
}

/**
 * Discovers network IPv4 addresses available on this host.
 * Prioritizes standard Wi-Fi and Ethernet adapters over virtual/VPN adapters.
 */
export function getAvailableNetworkIps(): LocalIpEntry[] {
  const interfaces = os.networkInterfaces();
  const entries: LocalIpEntry[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      // We only care about non-internal IPv4
      if (addr.family === 'IPv4' && !addr.internal) {
        const lowerName = name.toLowerCase();
        const isVirtual =
          lowerName.includes('vpn') ||
          lowerName.includes('virtual') ||
          lowerName.includes('vmware') ||
          lowerName.includes('vbox') ||
          lowerName.includes('radmin') ||
          lowerName.includes('hamachi') ||
          lowerName.includes('wsl') ||
          lowerName.includes('tailscale') ||
          lowerName.includes('zerotier');

        entries.push({
          name,
          ip: addr.address,
          isVirtual,
        });
      }
    }
  }

  // Sort: physical LAN interfaces (Ethernet, Wi-Fi) first, then virtual
  entries.sort((a, b) => {
    if (a.isVirtual === b.isVirtual) {
      return a.name.localeCompare(b.name);
    }
    return a.isVirtual ? 1 : -1;
  });

  return entries;
}

/**
 * Returns primary LAN IPv4 address (e.g., 192.168.1.xxx)
 */
export function getPrimaryLanIp(): string {
  const ips = getAvailableNetworkIps();
  if (ips.length > 0 && ips[0]) {
    return ips[0].ip;
  }
  return '127.0.0.1';
}

/**
 * Generates pairing information for wireless mobile camera terminals
 */
export function getPairingInfo(token?: string): PairingInfoResponse {
  const all = getAvailableNetworkIps();
  const detectedIp = getPrimaryLanIp();
  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';

  return {
    detectedIp,
    allIps: all.map((item) => ({ name: item.name, ip: item.ip })),
    httpPort: config.PORT,
    httpsPort: config.HTTPS_PORT,
    httpsAvailable: config.ENABLE_HTTPS,
    urls: {
      scannerHttps: `https://${detectedIp}:${config.HTTPS_PORT}/scanner.html${tokenParam}`,
      scannerHttp: `http://${detectedIp}:${config.PORT}/scanner.html${tokenParam}`,
      appHttps: `https://${detectedIp}:${config.HTTPS_PORT}/${tokenParam}`,
      appHttp: `http://${detectedIp}:${config.PORT}/${tokenParam}`,
    },
  };
}
