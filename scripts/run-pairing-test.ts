import { createPairingEngine } from '../server/pairingEngine';
import { db, pool } from '../server/db';

async function main() {
  const pairingEngine = createPairingEngine(db as any);
  const challengeId = '1'; // adjust if you have a known open challenge id

  console.log('Joining user A (YES)');
  const resA = await pairingEngine.joinChallenge('test_user_A', challengeId, 'YES', 100);
  console.log('Result A:', resA);

  console.log('Joining user B (NO)');
  const resB = await pairingEngine.joinChallenge('test_user_B', challengeId, 'NO', 100);
  console.log('Result B:', resB);

  // Close the DB pool so the Node process can exit cleanly
  try {
    await pool.end();
  } catch (err) {
    // ignore
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  });
