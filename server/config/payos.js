import { PayOS } from '@payos/node';
import dotenv from "dotenv";

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tìm .env file: thử trong server/ trước, sau đó thử parent directory
dotenv.config({ path: join(__dirname, "../.env") });
if (!process.env.DB_URI) {
  dotenv.config({ path: join(__dirname, "../../.env") });
}

export const payOSpayment = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
});

export const payOSpayout = new PayOS({
  clientId: process.env.PAYOS_PAYOUT_CLIENT_ID,
  apiKey: process.env.PAYOS_PAYOUT_API_KEY,
  checksumKey: process.env.PAYOS_PAYOUT_CHECKSUM_KEY,
});