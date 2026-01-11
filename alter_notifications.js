import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function run() {
  try {
    console.log('Altering notifications.fomo_level: DROP NOT NULL, SET DEFAULT "low"');
    await pool.query("ALTER TABLE public.notifications ALTER COLUMN fomo_level DROP NOT NULL;");
    await pool.query("ALTER TABLE public.notifications ALTER COLUMN fomo_level SET DEFAULT 'low';");
    console.log('Done');
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
    process.exit(1);
  }
}

run();
