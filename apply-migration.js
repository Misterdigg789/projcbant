import { readFileSync } from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 0,
});

async function applyMigration() {
  try {
    const sql = readFileSync('./migrations/0000_gray_harrier.sql', 'utf-8');
    const statements = sql.split('--> statement-breakpoint').filter(s => s.trim());
    
    console.log(`Found ${statements.length} SQL statements to execute...\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (!statement) continue;
      
      try {
        const result = await pool.query(statement);
        console.log(`✓ Statement ${i + 1}/${statements.length}: ${statement.substring(0, 50)}...`);
      } catch (error) {
        if (error.code === '42P07') {
          console.log(`✓ Statement ${i + 1}/${statements.length}: Already exists`);
        } else {
          console.log(`✗ Statement ${i + 1}/${statements.length}: ${error.code} - ${error.message}`);
          console.log(`   SQL: ${statement.substring(0, 80)}...`);
        }
      }
    }
    
    console.log('\n✅ Schema creation completed!');
    await pool.end();
  } catch (error) {
    console.error('Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

applyMigration();
