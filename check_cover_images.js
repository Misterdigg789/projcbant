const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function check() {
  try {
    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        "adminCreated",
        "coverImageUrl",
        LENGTH("coverImageUrl"::text) as url_length
      FROM challenges 
      WHERE "adminCreated" = true 
      LIMIT 5`
    );
    console.log('Admin-created challenges:');
    console.log(JSON.stringify(result.rows, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
