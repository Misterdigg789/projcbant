#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();
const { Client } = pg;

const COVER_URL = process.env.COVER_IMAGE_URL || process.argv[2];
if (!COVER_URL) {
  console.error('Usage: set COVER_IMAGE_URL env or pass URL as first arg');
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Please set DATABASE_URL environment variable');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT id, title FROM challenges WHERE cover_image_url IS NULL ORDER BY created_at DESC LIMIT 100');
    console.log(`Found ${rows.length} challenges without a cover image (preview up to 100).`);
    if (rows.length === 0) {
      console.log('Nothing to update. Exiting.');
      return;
    }

    // Perform update in a single statement
    const res = await client.query(
      'UPDATE challenges SET cover_image_url = $1 WHERE cover_image_url IS NULL RETURNING id',
      [COVER_URL]
    );
    console.log(`Updated ${res.rowCount} challenges.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Error running script:', err);
  process.exit(1);
});
