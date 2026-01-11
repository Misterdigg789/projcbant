/**
 * Test script for refund flow
 * Tests: Cancel queue entry, verify refund transaction, check notification and balance
 */

const http = require('http');

// Test user IDs
const testUserId = 'test-user-123';
const testChallengeId = '1'; // numeric ID
const testStakeAmount = 500;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-token', // Would need real Privy token
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testRefundFlow() {
  console.log('=== REFUND FLOW TEST ===\n');

  try {
    // Step 1: Get initial balance
    console.log('Step 1: Checking initial balance...');
    const balanceRes = await makeRequest('GET', '/api/users/me/balance');
    const initialBalance = balanceRes.body?.balance || 0;
    console.log(`✓ Initial balance: ₦${initialBalance.toLocaleString()}\n`);

    // Step 2: Join queue (create waiting entry)
    console.log('Step 2: Joining challenge queue...');
    const joinRes = await makeRequest('POST', `/api/challenges/${testChallengeId}/queue/join`, {
      side: 'YES',
      stakeAmount: testStakeAmount
    });
    console.log('Join response:', JSON.stringify(joinRes.body, null, 2));
    if (joinRes.status !== 200) {
      console.log('❌ Failed to join queue');
      return;
    }
    const queuePosition = joinRes.body.queuePosition;
    console.log(`✓ Added to queue at position ${queuePosition}\n`);

    // Step 3: Check balance after join (should be deducted)
    console.log('Step 3: Checking balance after joining...');
    const balanceAfterJoin = await makeRequest('GET', '/api/users/me/balance');
    const balanceAfterJoinAmount = balanceAfterJoin.body?.balance || 0;
    console.log(`✓ Balance after join: ₦${balanceAfterJoinAmount.toLocaleString()}`);
    const deducted = initialBalance - balanceAfterJoinAmount;
    console.log(`  Deducted: ₦${deducted.toLocaleString()} (expected: ₦${testStakeAmount.toLocaleString()})\n`);

    // Step 4: Cancel from queue
    console.log('Step 4: Cancelling from queue...');
    const cancelRes = await makeRequest('POST', `/api/challenges/${testChallengeId}/queue/cancel`);
    console.log('Cancel response:', JSON.stringify(cancelRes.body, null, 2));
    if (cancelRes.status !== 200) {
      console.log('❌ Failed to cancel queue');
      return;
    }
    console.log('✓ Successfully cancelled from queue\n');

    // Step 5: Check balance after cancellation (should be restored)
    console.log('Step 5: Checking balance after cancellation...');
    const balanceAfterCancel = await makeRequest('GET', '/api/users/me/balance');
    const balanceAfterCancelAmount = balanceAfterCancel.body?.balance || 0;
    console.log(`✓ Balance after cancel: ₦${balanceAfterCancelAmount.toLocaleString()}`);
    const refunded = balanceAfterCancelAmount - balanceAfterJoinAmount;
    console.log(`  Refunded: ₦${refunded.toLocaleString()} (expected: ₦${testStakeAmount.toLocaleString()})\n`);

    // Step 6: Get transactions to verify refund transaction created
    console.log('Step 6: Checking transaction history...');
    const txRes = await makeRequest('GET', '/api/users/me/transactions');
    console.log('Transactions:', JSON.stringify(txRes.body, null, 2));
    const refundTx = txRes.body?.find((tx) => 
      tx.type === 'challenge_queue_refund' && 
      tx.relatedId === testChallengeId
    );
    if (refundTx) {
      console.log(`✓ Refund transaction created: ${refundTx.id}`);
      console.log(`  Amount: ₦${Math.abs(refundTx.amount).toLocaleString()}`);
      console.log(`  Type: ${refundTx.type}\n`);
    } else {
      console.log('⚠ Refund transaction not found in history\n');
    }

    // Step 7: Get notifications (if available)
    console.log('Step 7: Checking notifications...');
    const notifRes = await makeRequest('GET', '/api/notifications');
    if (notifRes.body && Array.isArray(notifRes.body)) {
      const cancelNotif = notifRes.body.find(n => 
        n.body?.includes('Refunded') || n.title?.includes('Refunded')
      );
      if (cancelNotif) {
        console.log(`✓ Refund notification found:`);
        console.log(`  Title: ${cancelNotif.title}`);
        console.log(`  Body: ${cancelNotif.body}\n`);
      } else {
        console.log('⚠ Refund notification not found\n');
      }
    }

    // Summary
    console.log('=== TEST SUMMARY ===');
    const success = balanceAfterCancelAmount >= initialBalance;
    if (success) {
      console.log('✅ REFUND FLOW TEST PASSED');
      console.log(`   Initial: ₦${initialBalance.toLocaleString()}`);
      console.log(`   Final: ₦${balanceAfterCancelAmount.toLocaleString()}`);
      console.log(`   Status: ✓ Balance restored`);
    } else {
      console.log('❌ REFUND FLOW TEST FAILED');
      console.log(`   Final balance (${balanceAfterCancelAmount}) less than initial (${initialBalance})`);
    }

  } catch (error) {
    console.error('Test error:', error);
  }
}

testRefundFlow();
