console.log('DATABASE_URL env:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);

import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL not set!');
  process.exit(1);
}

console.log('Creating pool...');
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 0,
});

console.log('Pool created, connecting...');

pool.connect((err, client, release) => {
  if (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected!');
  client.query('SELECT 1 as test', (err, result) => {
    if (err) {
      console.error('Query error:', err.message);
    } else {
      console.log('✓ Query successful!');
    }
    release();
    pool.end(() => process.exit(0));
  });
});

setTimeout(() => {
  console.error('Connection timeout');
  process.exit(1);
}, 10000);
