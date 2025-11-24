/**
 * Test script to simulate 200 users joining the queue simultaneously
 * Run with: node test.js
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const NUM_USERS = 200;

// Generate random items for each user
function generateRandomItems() {
  const items = [];
  
  // Randomly add chai (70% chance)
  if (Math.random() > 0.3) {
    items.push({
      name: "Irani Chai",
      qty: Math.floor(Math.random() * 3) + 1 // 1-3 chai
    });
  }
  
  // Randomly add bun (50% chance)
  if (Math.random() > 0.5) {
    items.push({
      name: "Bun",
      qty: Math.floor(Math.random() * 2) + 1 // 1-2 bun
    });
  }
  
  // Ensure at least one item
  if (items.length === 0) {
    items.push({
      name: "Irani Chai",
      qty: 1
    });
  }
  
  return items;
}

// Simulate a single user joining
async function joinQueue(userId) {
  const startTime = Date.now();
  const name = `Test User ${userId}`;
  const items = generateRandomItems();
  
  try {
    const response = await fetch(`${BASE_URL}/api/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      success: response.ok,
      status: response.status,
      duration,
      data: response.ok ? data : data.error,
      items
    };
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    return {
      userId,
      success: false,
      status: 0,
      duration,
      data: error.message,
      items
    };
  }
}

// Main test function
async function runTest() {
  console.log(`🚀 Starting test: ${NUM_USERS} users joining simultaneously`);
  console.log(`📍 Target URL: ${BASE_URL}/api/join\n`);
  
  const startTime = Date.now();
  
  // Create all requests at once (concurrent)
  const promises = [];
  for (let i = 1; i <= NUM_USERS; i++) {
    promises.push(joinQueue(i));
  }
  
  // Wait for all requests to complete
  const results = await Promise.all(promises);
  
  const endTime = Date.now();
  const totalDuration = endTime - startTime;
  
  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
  const minDuration = Math.min(...results.map(r => r.duration));
  const maxDuration = Math.max(...results.map(r => r.duration));
  
  // Group failures by status code
  const failuresByStatus = {};
  failed.forEach(r => {
    const status = r.status || 'NETWORK_ERROR';
    failuresByStatus[status] = (failuresByStatus[status] || 0) + 1;
  });
  
  // Print summary
  console.log('='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Users: ${NUM_USERS}`);
  console.log(`✅ Successful: ${successful.length} (${((successful.length / NUM_USERS) * 100).toFixed(2)}%)`);
  console.log(`❌ Failed: ${failed.length} (${((failed.length / NUM_USERS) * 100).toFixed(2)}%)`);
  console.log(`\n⏱️  Timing:`);
  console.log(`   Total Duration: ${totalDuration}ms`);
  console.log(`   Average Request Time: ${avgDuration.toFixed(2)}ms`);
  console.log(`   Min Request Time: ${minDuration}ms`);
  console.log(`   Max Request Time: ${maxDuration}ms`);
  
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
  
  console.log('='.repeat(60));
  
  // Return results for potential further analysis
  return {
    total: NUM_USERS,
    successful: successful.length,
    failed: failed.length,
    totalDuration,
    avgDuration,
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




