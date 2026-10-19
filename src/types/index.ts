import type { Request } from 'express';

export type UserRole = 'owner' | 'manager' | 'cashier';

export interface TokenPayload {
  userId: string;
  businessId: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export interface Item {
  id: string;
  business_id: string;
  sku: string;
  barcode: string | null;
  name: string;
  category: string;
  unit_cost_default: number;
  min_stock_level: number;
  created_at: string;
  updated_at: string;
}

export interface StockSnapshotItem extends Item {
  quantity: number;
  last_updated: string | null;
  valuation: number;
  stock_status: 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  internal: boolean;
}

export interface PairingInfoResponse {
  detectedIp: string;
  allIps: Array<{ name: string; ip: string }>;
  httpPort: number;
  httpsPort: number;
  httpsAvailable: boolean;
  urls: {
    scannerHttps: string;
    scannerHttp: string;
    appHttps: string;
    appHttp: string;
  };
}
