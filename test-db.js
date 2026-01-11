const { Pool } = require('pg');

const url = "postgresql://postgres.qtcvtyakpxaxabxwbwsw:vCnTlkRbkmagd7ZK%40@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require";

console.log('Testing connection with URL:', url.replace(/:[^@]*@/, ':***@'));

const pool = new Pool({
  connectionString: url,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.query('SELECT 1', (err, res) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('Error code:', err.code);
  } else {
    console.log('✅ Connection successful!', res.rows);
  }
  pool.end();
  process.exit(err ? 1 : 0);
});

setTimeout(() => {
  console.error('❌ Timeout after 10 seconds');
  process.exit(1);
}, 10000);
