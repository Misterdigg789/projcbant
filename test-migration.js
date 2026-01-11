import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 0,
});

async function testMigration() {
  try {
    // Try to query the users table
    const result = await pool.query(`SELECT COUNT(*) as count FROM users LIMIT 1`);
    console.log('✓ Users table exists! Row count:', result.rows[0]);
    
    // Get table structure
    const columns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users'
      LIMIT 20
    `);
    console.log('Columns found:', columns.rows.length);
    columns.rows.forEach(row => console.log('  -', row.column_name));
    
  } catch (error) {
    console.error('✗ Error:', error.message.substring(0, 200));
  } finally {
    await pool.end();
  }
}

testMigration();
