/**
 * Load Test for The Chai Couple Queue API
 * 
 * Tests the /api/join endpoint with realistic concurrent users
 * 
 * Usage:
 *   Test Production: BASE_URL=https://thechaicouple.devou.in node test.js
 *   Test Local:      BASE_URL=http://localhost:3000 node test.js
 *   Custom users:    NUM_USERS=100 BASE_URL=https://thechaicouple.devou.in node test.js
 */

const BASE_URL = process.env.BASE_URL || 'https://thechaicouple.devou.in';
const NUM_USERS = parseInt(process.env.NUM_USERS) || 50;
const RAMP_UP_TIME = parseInt(process.env.RAMP_UP_TIME) || 0; // ms between requests

// Generate random items for each user
function generateRandomItems() {
  const items = [];
  
  // 80% of customers order chai
  if (Math.random() > 0.2) {
    items.push({
      name: "Special Chai",
      qty: Math.floor(Math.random() * 3) + 1 // 1-3 chai
    });
  }
  
  // 60% of customers order bun
  if (Math.random() > 0.4) {
    items.push({
      name: "Bun",
      qty: Math.floor(Math.random() * 3) + 1 // 1-3 buns
    });
  }
  
  // 20% of customers order tiramisu
  if (Math.random() > 0.8) {
    items.push({
      name: "Tiramisu",
      qty: Math.floor(Math.random() * 2) + 1 // 1-2 tiramisu
    });
  }
  
  // Ensure at least one item
  if (items.length === 0) {
    items.push({
      name: "Special Chai",
      qty: 1
    });
  }
  
  return items;
}

// Generate idempotency key
function generateIdempotencyKey() {
  return `load_test_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

// Simulate a single user joining
async function joinQueue(userId) {
  const startTime = Date.now();
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const items = generateRandomItems();
  const idempotencyKey = generateIdempotencyKey();
  
  try {
    const response = await fetch(`${BASE_URL}/api/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        name,
        items
      }),
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    const data = await response.json();
    
    return {
      userId,
      name,
      success: response.ok,
      status: response.status,
      duration,
      data: response.ok ? data : data.error,
      items,
      idempotencyKey
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    return {
      userId,
      name,
      success: false,
      status: 0,
      duration,
      data: error.message,
      items,
      idempotencyKey
    };
  }
}

// Delay function for ramp-up
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function
async function runTest() {
  console.log('='.repeat(60));
  console.log('🧪 THE CHAI COUPLE - LOAD TEST');
  console.log('='.repeat(60));
  console.log(`📍 Target: ${BASE_URL}/api/join`);
  console.log(`👥 Users: ${NUM_USERS}`);
  console.log(`⏱️  Ramp-up: ${RAMP_UP_TIME}ms between requests`);
  console.log(`⏰ Start Time: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
  console.log('\n🚀 Starting load test...\n');
  
  const startTime = Date.now();
  
  // Create requests with optional ramp-up
  const promises = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    promises.push(
      (async () => {
        if (RAMP_UP_TIME > 0) {
          await delay(i * RAMP_UP_TIME);
        }
        return joinQueue(i);
      })()
    );
    
    // Show progress every 10 users
    if (i % 10 === 0) {
      process.stdout.write(`\r   Queued: ${i}/${NUM_USERS} users...`);
    }
  }
  
  process.stdout.write(`\r   Queued: ${NUM_USERS}/${NUM_USERS} users... ✓\n`);
  console.log('   Waiting for responses...\n');
  
  // Wait for all requests to complete
  const results = await Promise.all(promises);
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const durations = results.map(r => r.duration).sort((a, b) => a - b);
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const minDuration = durations[0];
  const maxDuration = durations[durations.length - 1];
  const medianDuration = durations[Math.floor(durations.length / 2)];
  const p95Duration = durations[Math.floor(durations.length * 0.95)];
  const p99Duration = durations[Math.floor(durations.length * 0.99)];
  
  // Calculate throughput
  const requestsPerSecond = (NUM_USERS / (totalDuration / 1000)).toFixed(2);
  
  // Group failures by status code
  const failuresByStatus = {};
  failed.forEach(r => {
    const status = r.status || 'NETWORK_ERROR';
    failuresByStatus[status] = (failuresByStatus[status] || 0) + 1;
  });
  
  // Calculate items ordered
  const totalChai = successful.reduce((sum, r) => {
    const chai = r.items.find(i => i.name === "Special Chai");
    return sum + (chai?.qty || 0);
  }, 0);
  const totalBun = successful.reduce((sum, r) => {
    const bun = r.items.find(i => i.name === "Bun");
    return sum + (bun?.qty || 0);
  }, 0);
  const totalTiramisu = successful.reduce((sum, r) => {
    const tiramisu = r.items.find(i => i.name === "Tiramisu");
    return sum + (tiramisu?.qty || 0);
  }, 0);
  
  // Print summary
  console.log('='.repeat(60));
  console.log('📊 LOAD TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`\n📈 Success Rate:`);
  console.log(`   Total Requests: ${NUM_USERS}`);
  console.log(`   ✅ Successful: ${successful.length} (${((successful.length / NUM_USERS) * 100).toFixed(2)}%)`);
  console.log(`   ❌ Failed: ${failed.length} (${((failed.length / NUM_USERS) * 100).toFixed(2)}%)`);
  console.log(`   🚀 Throughput: ${requestsPerSecond} req/s`);
  
  console.log(`\n⏱️  Response Times:`);
  console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`   Average: ${avgDuration.toFixed(2)}ms`);
  console.log(`   Median: ${medianDuration.toFixed(2)}ms`);
  console.log(`   Min: ${minDuration}ms`);
  console.log(`   Max: ${maxDuration}ms`);
  console.log(`   95th Percentile: ${p95Duration}ms`);
  console.log(`   99th Percentile: ${p99Duration}ms`);
  
  if (successful.length > 0) {
    console.log(`\n🍵 Items Ordered:`);
    console.log(`   Special Chai: ${totalChai}`);
    console.log(`   Bun: ${totalBun}`);
    console.log(`   Tiramisu: ${totalTiramisu}`);
    console.log(`   Total Items: ${totalChai + totalBun + totalTiramisu}`);
  }
  
  if (failed.length > 0) {
    console.log(`\n❌ Failures by Status:`);
    Object.entries(failuresByStatus).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
    
    // Show first 5 failure details
    console.log(`\n📝 First 5 Failure Details:`);
    failed.slice(0, 5).forEach(r => {
      console.log(`   User ${r.userId}: Status ${r.status} - ${r.data}`);
    });
  }
  
  // Show position distribution for successful joins
  if (successful.length > 0) {
    const positions = successful.map(r => r.data?.position).filter(p => p !== undefined);
    if (positions.length > 0) {
      console.log(`\n🎯 Position Distribution:`);
      console.log(`   First Position: ${Math.min(...positions)}`);
      console.log(`   Last Position: ${Math.max(...positions)}`);
      console.log(`   Expected Range: 1-${NUM_USERS}`);
      
      // Check for duplicate positions (shouldn't happen)
      const uniquePositions = new Set(positions);
      if (uniquePositions.size !== positions.length) {
        console.log(`   ⚠️  WARNING: Duplicate positions detected!`);
        const duplicates = positions.filter((p, i) => positions.indexOf(p) !== i);
        console.log(`   Duplicate positions: ${[...new Set(duplicates)].join(', ')}`);
      } else {
        console.log(`   ✅ All positions are unique`);
      }
    }
  }
  
  // Performance assessment
  console.log(`\n💡 Performance Assessment:`);
  if (avgDuration < 200) {
    console.log(`   ⚡ Excellent - Average response time under 200ms`);
  } else if (avgDuration < 500) {
    console.log(`   ✅ Good - Average response time under 500ms`);
  } else if (avgDuration < 1000) {
    console.log(`   ⚠️  Fair - Average response time under 1s`);
  } else {
    console.log(`   🔴 Poor - Average response time over 1s`);
  }
  
  if (successful.length / NUM_USERS >= 0.99) {
    console.log(`   ⚡ Excellent - 99%+ success rate`);
  } else if (successful.length / NUM_USERS >= 0.95) {
    console.log(`   ✅ Good - 95%+ success rate`);
  } else if (successful.length / NUM_USERS >= 0.90) {
    console.log(`   ⚠️  Fair - 90%+ success rate`);
  } else {
    console.log(`   🔴 Poor - Below 90% success rate`);
  }
  
  console.log('='.repeat(60));
  console.log(`⏰ Completed: ${new Date().toLocaleString()}`);
  console.log('='.repeat(60));
  
  // Return results for potential further analysis
  return {
    total: NUM_USERS,
    successful: successful.length,
    failed: failed.length,
    totalDuration,
    avgDuration,
    medianDuration,
    p95Duration,
    p99Duration,
    requestsPerSecond,
    results
  };
}

// Run the test
if (require.main === module) {
  runTest()
    .then(() => {
      console.log('\n✅ Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { runTest, joinQueue };









