import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  idleTimeoutMillis: 0,
});

async function dropAndRecreate() {
  try {
    console.log('Dropping old tables with data loss...');
    
    // Drop dependent tables first (foreign key constraints)
    const dropQueries = [
      'DROP TABLE IF EXISTS public.user_achievements CASCADE',
      'DROP TABLE IF EXISTS public.referral_rewards CASCADE',
      'DROP TABLE IF EXISTS public.referrals CASCADE',
      'DROP TABLE IF EXISTS public.transactions CASCADE',
      'DROP TABLE IF EXISTS public.challenge_messages CASCADE',
      'DROP TABLE IF EXISTS public.escrow CASCADE',
      'DROP TABLE IF EXISTS public.challenges CASCADE',
      'DROP TABLE IF EXISTS public.event_messages CASCADE',
      'DROP TABLE IF EXISTS public.event_participants CASCADE',
      'DROP TABLE IF EXISTS public.event_join_requests CASCADE',
      'DROP TABLE IF EXISTS public.event_pools CASCADE',
      'DROP TABLE IF EXISTS public.event_activity CASCADE',
      'DROP TABLE IF EXISTS public.event_matches CASCADE',
      'DROP TABLE IF EXISTS public.events CASCADE',
      'DROP TABLE IF EXISTS public.daily_logins CASCADE',
      'DROP TABLE IF EXISTS public.notifications CASCADE',
      'DROP TABLE IF EXISTS public.push_subscriptions CASCADE',
      'DROP TABLE IF EXISTS public.story_views CASCADE',
      'DROP TABLE IF EXISTS public.stories CASCADE',
      'DROP TABLE IF EXISTS public.message_reactions CASCADE',
      'DROP TABLE IF EXISTS public.group_members CASCADE',
      'DROP TABLE IF EXISTS public.groups CASCADE',
      'DROP TABLE IF EXISTS public.achievements CASCADE',
      'DROP TABLE IF EXISTS public.users CASCADE'
    ];
    
    for (const query of dropQueries) {
      await pool.query(query);
      console.log(`✓ ${query}`);
    }
    
    console.log('\n✅ All old tables dropped!');
    console.log('Now restart the server to recreate tables with new schema...');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

dropAndRecreate();
