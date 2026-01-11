import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 0,
});

async function check() {
  try {
    const result = await pool.query(`
      SELECT table_schema, table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('users', 'events', 'challenges')
      ORDER BY table_schema, table_name
    `);
    
    console.log('Tables found:');
    result.rows.forEach(r => console.log(`  ${r.table_schema}.${r.table_name}`));
    
    await pool.end();
  } catch (e) {
    console.error('Error:', e.message);
    await pool.end();
  }
}

check();
