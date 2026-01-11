#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import pkg from 'pg';
const { Client } = pkg;

// Load environment variables
config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Read migration file
    const migrationPath = resolve('./migrations/0000_gray_harrier.sql');
    const migrationSql = readFileSync(migrationPath, 'utf-8');

    console.log('📝 Running migration...');
    await client.query(migrationSql);
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
