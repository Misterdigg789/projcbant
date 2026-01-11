import { sql } from 'drizzle-orm';
import { pool } from './server/db.ts';
import { readFileSync } from 'fs';

async function resetSchema() {
  try {
    console.log('Dropping all tables...');
    
    // Drop all tables in the correct order (respecting foreign keys)
    const dropQueries = [
      'DROP TABLE IF EXISTS group_members CASCADE',
      'DROP TABLE IF EXISTS groups CASCADE',
      'DROP TABLE IF EXISTS stories CASCADE',
      'DROP TABLE IF EXISTS push_subscriptions CASCADE',
      'DROP TABLE IF EXISTS message_reactions CASCADE',
      'DROP TABLE IF EXISTS event_messages CASCADE',
      'DROP TABLE IF EXISTS challenge_messages CASCADE',
      'DROP TABLE IF EXISTS event_participants CASCADE',
      'DROP TABLE IF EXISTS events CASCADE',
      'DROP TABLE IF EXISTS event_join_requests CASCADE',
      'DROP TABLE IF EXISTS event_pools CASCADE',
      'DROP TABLE IF EXISTS event_activity CASCADE',
      'DROP TABLE IF EXISTS event_matches CASCADE',
      'DROP TABLE IF EXISTS referral_rewards CASCADE',
      'DROP TABLE IF EXISTS referrals CASCADE',
      'DROP TABLE IF EXISTS transactions CASCADE',
      'DROP TABLE IF EXISTS user_achievements CASCADE',
      'DROP TABLE IF EXISTS achievements CASCADE',
      'DROP TABLE IF EXISTS notifications CASCADE',
      'DROP TABLE IF EXISTS daily_logins CASCADE',
      'DROP TABLE IF EXISTS escrow CASCADE',
      'DROP TABLE IF EXISTS challenges CASCADE',
      'DROP TABLE IF EXISTS users CASCADE'
    ];
    
    for (const query of dropQueries) {
      await pool.query(query);
      console.log(`✓ ${query}`);
    }
    
    console.log('\n✅ All tables dropped successfully');
    console.log('\nNow running npm run db:push to create fresh schema...');
    
    process.exit(0);
  } catch (error) {
    console.error('Error resetting schema:', error);
    process.exit(1);
  }
}

resetSchema();
