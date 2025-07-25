/**
 * Master Test Runner
 * Runs all Voice Matrix tests in sequence
 * Run with: node tests/run-all-tests.js
 */

const { runTests: runBackendTests } = require('./backend-api-tests');
const { runVAPITests } = require('./vapi-integration-tests');
const { runAdminTests } = require('./admin-dashboard-tests');
const { runE2ETests } = require('./e2e-user-journey-tests');

class MasterTestRunner {
  constructor() {
    this.allResults = [];
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🚀 VOICE MATRIX COMPREHENSIVE TEST SUITE');
    console.log('=' .repeat(60));
    console.log('Testing complete application functionality...\n');

    const testSuites = [
      {
        name: 'Backend API Tests',
        runner: runBackendTests,
        description: 'Testing all backend endpoints and authentication'
      },
      {
        name: 'VAPI Integration Tests', 
        runner: runVAPITests,
        description: 'Testing VAPI connectivity and functionality'
      },
      {
        name: 'Admin Dashboard Tests',
        runner: runAdminTests,
        description: 'Testing admin functionality and permissions'
      },
      {
        name: 'End-to-End User Journey Tests',
        runner: runE2ETests,
        description: 'Testing complete user workflows'
      }
    ];

    for (const suite of testSuites) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 ${suite.name.toUpperCase()}`);
      console.log(`📝 ${suite.description}`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        const results = await suite.runner();
        this.allResults.push({
          suite: suite.name,
          results,
          status: 'completed'
        });
        
        console.log(`✅ ${suite.name} completed successfully`);
      } catch (error) {
        console.error(`❌ ${suite.name} failed:`, error.message);
        this.allResults.push({
          suite: suite.name,
          results: [],
          status: 'failed',
          error: error.message
        });
      }

      // Wait between test suites to avoid overwhelming the API
      await this.sleep(2000);
    }

    this.printFinalSummary();
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printFinalSummary() {
    const endTime = Date.now();
    const duration = Math.round((endTime - this.startTime) / 1000);

    console.log('\n' + '='.repeat(70));
    console.log('🏆 VOICE MATRIX TEST SUITE - FINAL RESULTS');
    console.log('='.repeat(70));

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;

    this.allResults.forEach(suite => {
      console.log(`\n📊 ${suite.suite}:`);
      
      if (suite.status === 'failed') {
        console.log(`   ❌ Suite Failed: ${suite.error}`);
        totalFailed += 1;
      } else {
        const passed = suite.results.filter(r => r.status === 'PASS').length;
        const failed = suite.results.filter(r => r.status === 'FAIL').length;
        
        console.log(`   ✅ Passed: ${passed}`);
        console.log(`   ❌ Failed: ${failed}`);
        console.log(`   📊 Total: ${suite.results.length}`);
        
        totalTests += suite.results.length;
        totalPassed += passed;
        totalFailed += failed;
      }
    });

    console.log('\n' + '='.repeat(70));
    console.log('📈 OVERALL SUMMARY:');
    console.log(`   🎯 Total Test Suites: ${this.allResults.length}`);
    console.log(`   📊 Total Individual Tests: ${totalTests}`);
    console.log(`   ✅ Total Passed: ${totalPassed}`);
    console.log(`   ❌ Total Failed: ${totalFailed}`);
    console.log(`   ⏱️  Total Duration: ${duration} seconds`);

    const successRate = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    console.log(`   📊 Success Rate: ${successRate}%`);

    console.log('\n' + '='.repeat(70));

    if (totalFailed === 0) {
      console.log('🎉 ALL TESTS PASSED! Voice Matrix is fully functional!');
      console.log('✨ Your application is ready for production use!');
    } else if (successRate >= 80) {
      console.log('⚠️  Most tests passed, but some issues need attention.');
      console.log('🔧 Check the failed tests above for specific issues.');
    } else {
      console.log('❌ Multiple test failures detected.');
      console.log('🚨 Please review and fix the issues before production deployment.');
    }

    console.log('\n🔗 Application URL: https://main.d3nqtyqk3krtlj.amplifyapp.com');
    console.log('🔑 Admin PIN: 123456');
    console.log('📞 VAPI Key: 661b91f4-60e3-457e-820a-1dc7987b2b1c');
    console.log('='.repeat(70));
  }

  // Generate test report
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Math.round((Date.now() - this.startTime) / 1000),
      suites: this.allResults,
      summary: {
        totalSuites: this.allResults.length,
        completedSuites: this.allResults.filter(s => s.status === 'completed').length,
        failedSuites: this.allResults.filter(s => s.status === 'failed').length,
        totalTests: this.allResults.reduce((sum, s) => sum + (s.results?.length || 0), 0),
        totalPassed: this.allResults.reduce((sum, s) => 
          sum + (s.results?.filter(r => r.status === 'PASS').length || 0), 0),
        totalFailed: this.allResults.reduce((sum, s) => 
          sum + (s.results?.filter(r => r.status === 'FAIL').length || 0), 0)
      }
    };

    return report;
  }
}

// Quick test runner for specific components
async function quickTest(component) {
  console.log(`🎯 Running quick test for: ${component}\n`);

  switch (component.toLowerCase()) {
    case 'backend':
    case 'api':
      await runBackendTests();
      break;
    
    case 'vapi':
      await runVAPITests();
      break;
    
    case 'admin':
      await runAdminTests();
      break;
    
    case 'e2e':
    case 'journey':
      await runE2ETests();
      break;
    
    default:
      console.log(`❌ Unknown component: ${component}`);
      console.log('Available components: backend, vapi, admin, e2e');
      return;
  }

  console.log(`\n✅ Quick test for ${component} completed!`);
}

// Health check function
async function healthCheck() {
  console.log('🏥 Voice Matrix Health Check');
  console.log('='.repeat(40));

  const checks = [];

  try {
    // Check backend API
    const response = await fetch('https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '123456' })
    });

    if (response.ok) {
      checks.push({ service: 'Backend API', status: '✅ Healthy' });
    } else {
      checks.push({ service: 'Backend API', status: '❌ Error' });
    }
  } catch (error) {
    checks.push({ service: 'Backend API', status: '❌ Unreachable' });
  }

  try {
    // Check frontend
    const response = await fetch('https://main.d3nqtyqk3krtlj.amplifyapp.com');
    if (response.ok) {
      checks.push({ service: 'Frontend', status: '✅ Healthy' });
    } else {
      checks.push({ service: 'Frontend', status: '❌ Error' });
    }
  } catch (error) {
    checks.push({ service: 'Frontend', status: '❌ Unreachable' });
  }

  checks.forEach(check => {
    console.log(`${check.service}: ${check.status}`);
  });

  console.log('='.repeat(40));
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    healthCheck();
  } else if (args.includes('--quick')) {
    const component = args[args.indexOf('--quick') + 1];
    if (!component) {
      console.log('❌ Please specify component: --quick backend|vapi|admin|e2e');
      process.exit(1);
    }
    quickTest(component);
  } else {
    // Run all tests
    const runner = new MasterTestRunner();
    runner.runAllTests().then(() => {
      const report = runner.generateReport();
      
      // Optionally save report to file
      if (args.includes('--save-report')) {
        const fs = require('fs');
        fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Test report saved to test-report.json');
      }
      
      process.exit(0);
    }).catch(console.error);
  }
}

module.exports = { MasterTestRunner, quickTest, healthCheck };