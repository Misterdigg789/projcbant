import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProd = process.env.NODE_ENV === 'production';

// Session Pooler configuration for Supabase
// This works with IPv4 networks (like Codespaces)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: isProd ? true : false,
  },
  // Session pooler requires max: 1 connection per session
  max: 1,
  idleTimeoutMillis: 0,
});

pool.on('connect', () => {
  // Database connected
});

pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
});

export const db = drizzle(pool, { schema });