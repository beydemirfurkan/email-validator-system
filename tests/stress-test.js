const autocannon = require('autocannon');
const fs = require('fs');

// Stress test configurations
const testConfigs = [
  {
    name: 'Single Email Validation Stress Test',
    url: 'http://localhost:4444/api/validate-email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'evapi_test_key_here' // Replace with actual API key
    },
    body: JSON.stringify({
      email: 'test@gmail.com'
    }),
    connections: 100,
    duration: 30,
    pipelining: 1
  },
  {
    name: 'Batch Email Validation Stress Test',
    url: 'http://localhost:4444/api/validate-emails',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'evapi_test_key_here' // Replace with actual API key
    },
    body: JSON.stringify({
      emails: [
        'user1@gmail.com',
        'user2@yahoo.com',
        'user3@hotmail.com',
        'user4@outlook.com',
        'user5@example.com'
      ]
    }),
    connections: 50,
    duration: 30,
    pipelining: 1
  },
  {
    name: 'Authentication Stress Test',
    url: 'http://localhost:4444/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'test@example.com',
      password: 'TestPassword123!'
    }),
    connections: 200,
    duration: 20,
    pipelining: 1
  },
  {
    name: 'Health Check Stress Test',
    url: 'http://localhost:4444/api/health',
    method: 'GET',
    connections: 500,
    duration: 15,
    pipelining: 10
  }
];

async function runStressTests() {
  console.log('🚀 Starting comprehensive stress tests...\n');
  
  const results = [];
  
  for (const config of testConfigs) {
    console.log(`📊 Running: ${config.name}`);
    console.log(`🔗 URL: ${config.url}`);
    console.log(`👥 Connections: ${config.connections}`);
    console.log(`⏱️  Duration: ${config.duration}s\n`);
    
    try {
      const result = await autocannon(config);
      
      results.push({
        testName: config.name,
        ...result
      });
      
      console.log(`✅ ${config.name} completed`);
      console.log(`📈 Requests/sec: ${result.requests.average}`);
      console.log(`📊 Latency avg: ${result.latency.average}ms`);
      console.log(`🚫 Errors: ${result.errors}`);
      console.log(`📋 Status codes:`, result.statuses);
      console.log('─'.repeat(50) + '\n');
      
    } catch (error) {
      console.error(`❌ ${config.name} failed:`, error.message);
      results.push({
        testName: config.name,
        error: error.message
      });
    }
    
    // Wait between tests to allow system recovery
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Generate comprehensive report
  generateStressTestReport(results);
}

function generateStressTestReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = `./stress-test-report-${timestamp.replace(/[:.]/g, '-')}.json`;
  
  const report = {
    timestamp,
    summary: {
      totalTests: results.length,
      successfulTests: results.filter(r => !r.error).length,
      failedTests: results.filter(r => r.error).length
    },
    results: results.map(result => {
      if (result.error) {
        return {
          testName: result.testName,
          status: 'FAILED',
          error: result.error
        };
      }
      
      return {
        testName: result.testName,
        status: 'SUCCESS',
        performance: {
          requestsPerSecond: result.requests.average,
          totalRequests: result.requests.total,
          latencyAverage: result.latency.average,
          latencyP50: result.latency.p50,
          latencyP90: result.latency.p90,
          latencyP99: result.latency.p99,
          throughput: result.throughput.average,
          errors: result.errors,
          timeouts: result.timeouts,
          statusCodes: result.statuses
        },
        recommendations: generateRecommendations(result)
      };
    })
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log('📋 STRESS TEST SUMMARY');
  console.log('═'.repeat(50));
  console.log(`📊 Total Tests: ${report.summary.totalTests}`);
  console.log(`✅ Successful: ${report.summary.successfulTests}`);
  console.log(`❌ Failed: ${report.summary.failedTests}`);
  console.log(`📄 Detailed report: ${reportPath}\n`);
  
  // Print key findings
  results.forEach(result => {
    if (!result.error) {
      console.log(`🔍 ${result.testName}:`);
      console.log(`   RPS: ${result.requests.average.toFixed(2)}`);
      console.log(`   Latency: ${result.latency.average.toFixed(2)}ms`);
      console.log(`   P99 Latency: ${result.latency.p99.toFixed(2)}ms`);
      console.log(`   Errors: ${result.errors}`);
      console.log();
    }
  });
  
  // Performance analysis
  analyzePerformance(results);
}

function generateRecommendations(result) {
  const recommendations = [];
  
  // High latency check
  if (result.latency.average > 1000) {
    recommendations.push('High average latency detected. Consider optimizing database queries and adding caching.');
  }
  
  // High P99 latency check
  if (result.latency.p99 > 3000) {
    recommendations.push('High P99 latency detected. Some requests are taking too long. Consider connection pooling and query optimization.');
  }
  
  // Error rate check
  if (result.errors > 0) {
    recommendations.push(`${result.errors} errors detected. Check server logs and error handling.`);
  }
  
  // Low throughput check
  if (result.requests.average < 10) {
    recommendations.push('Low requests per second. Consider horizontal scaling or performance optimization.');
  }
  
  // Memory usage recommendation
  if (result.requests.average > 100) {
    recommendations.push('High load test passed. Monitor memory usage and consider implementing rate limiting.');
  }
  
  return recommendations;
}

function analyzePerformance(results) {
  console.log('🔬 PERFORMANCE ANALYSIS');
  console.log('═'.repeat(50));
  
  const successfulResults = results.filter(r => !r.error);
  
  if (successfulResults.length === 0) {
    console.log('❌ No successful tests to analyze');
    return;
  }
  
  // Calculate overall performance metrics
  const avgRPS = successfulResults.reduce((sum, r) => sum + r.requests.average, 0) / successfulResults.length;
  const avgLatency = successfulResults.reduce((sum, r) => sum + r.latency.average, 0) / successfulResults.length;
  const totalErrors = successfulResults.reduce((sum, r) => sum + r.errors, 0);
  
  console.log(`📊 Average RPS across all tests: ${avgRPS.toFixed(2)}`);
  console.log(`⏱️  Average latency: ${avgLatency.toFixed(2)}ms`);
  console.log(`🚫 Total errors: ${totalErrors}`);
  
  // Performance rating
  let rating = 'EXCELLENT';
  if (avgLatency > 500 || totalErrors > 10) rating = 'GOOD';
  if (avgLatency > 1000 || totalErrors > 50) rating = 'FAIR';
  if (avgLatency > 2000 || totalErrors > 100) rating = 'POOR';
  
  console.log(`🏆 Overall Performance Rating: ${rating}`);
  
  // Bottleneck identification
  console.log('\n🔍 BOTTLENECK ANALYSIS:');
  
  const emailValidationResults = successfulResults.filter(r => 
    r.testName.includes('Email Validation')
  );
  
  if (emailValidationResults.length > 0) {
    const slowestEmailTest = emailValidationResults.reduce((slow, current) => 
      current.latency.average > slow.latency.average ? current : slow
    );
    console.log(`📧 Slowest email validation: ${slowestEmailTest.testName} (${slowestEmailTest.latency.average.toFixed(2)}ms)`);
  }
  
  console.log('\n💡 OPTIMIZATION RECOMMENDATIONS:');
  if (avgLatency > 1000) {
    console.log('• Implement database connection pooling');
    console.log('• Add Redis caching for frequently accessed data');
    console.log('• Optimize database indexes');
    console.log('• Consider implementing horizontal scaling');
  }
  
  if (totalErrors > 0) {
    console.log('• Review error handling and logging');
    console.log('• Implement circuit breaker pattern');
    console.log('• Add proper timeout configurations');
  }
  
  if (avgRPS < 50) {
    console.log('• Profile CPU and memory usage');
    console.log('• Optimize algorithm complexity');
    console.log('• Consider using clustering');
  }
}

// Memory usage monitoring
function monitorMemoryUsage() {
  const usage = process.memoryUsage();
  console.log('💾 Memory Usage:');
  console.log(`   RSS: ${Math.round(usage.rss / 1024 / 1024)} MB`);
  console.log(`   Heap Used: ${Math.round(usage.heapUsed / 1024 / 1024)} MB`);
  console.log(`   Heap Total: ${Math.round(usage.heapTotal / 1024 / 1024)} MB`);
  console.log(`   External: ${Math.round(usage.external / 1024 / 1024)} MB`);
}

// Run stress tests
if (require.main === module) {
  console.log('⚠️  Make sure your API server is running on http://localhost:4444');
  console.log('⚠️  Update API keys in the test configuration\n');
  
  runStressTests().catch(console.error);
  
  // Monitor memory every 10 seconds during tests
  const memoryMonitor = setInterval(monitorMemoryUsage, 10000);
  
  // Stop memory monitoring after tests complete
  setTimeout(() => {
    clearInterval(memoryMonitor);
    console.log('🏁 Stress testing completed');
  }, 200000);
}

module.exports = { runStressTests };