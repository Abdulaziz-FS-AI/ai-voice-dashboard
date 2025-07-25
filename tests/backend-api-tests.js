/**
 * Backend API Tests
 * Tests all backend endpoints for Voice Matrix AI Dashboard
 * Run with: node tests/backend-api-tests.js
 */

const BASE_URL = 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production';

// Test utilities
class APITester {
  constructor() {
    this.results = [];
    this.adminToken = null;
    this.userToken = null;
  }

  async test(name, testFn) {
    try {
      console.log(`🧪 Testing: ${name}`);
      const result = await testFn();
      this.results.push({ name, status: 'PASS', result });
      console.log(`✅ PASS: ${name}`);
      return result;
    } catch (error) {
      this.results.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ FAIL: ${name} - ${error.message}`);
      throw error;
    }
  }

  async apiCall(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.results.length}\n`);

    if (failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
    }
  }
}

async function runTests() {
  const tester = new APITester();

  try {
    // Test 1: Admin Login
    await tester.test('Admin Login (PIN: 123456)', async () => {
      const result = await tester.apiCall('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: '123456' })
      });
      
      if (!result.token || !result.user) {
        throw new Error('Missing token or user in response');
      }
      
      tester.adminToken = result.token;
      return { 
        token: result.token.substring(0, 20) + '...', 
        user: result.user 
      };
    });

    // Test 2: User Registration
    await tester.test('User Registration', async () => {
      const testUser = {
        email: `test.user.${Date.now()}@voicematrix.ai`,
        password: 'testpassword123',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await tester.apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(testUser)
      });

      if (!result.token || !result.user) {
        throw new Error('Missing token or user in response');
      }

      tester.userToken = result.token;
      tester.testUser = testUser;
      return { 
        token: result.token.substring(0, 20) + '...', 
        user: result.user 
      };
    });

    // Test 3: User Login
    await tester.test('User Login', async () => {
      const result = await tester.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: tester.testUser.email,
          password: tester.testUser.password
        })
      });

      if (!result.token || !result.user) {
        throw new Error('Missing token or user in response');
      }

      return { 
        token: result.token.substring(0, 20) + '...', 
        user: result.user 
      };
    });

    // Test 4: Token Verification
    await tester.test('Token Verification', async () => {
      const result = await tester.apiCall('/auth/verify-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tester.userToken}`
        }
      });

      if (!result.valid || !result.user) {
        throw new Error('Token verification failed');
      }

      return result;
    });

    // Test 5: VAPI Assistants (with admin token)
    await tester.test('VAPI Assistants Endpoint', async () => {
      const result = await tester.apiCall('/vapi/assistants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      // Should return array (empty or with assistants)
      if (!Array.isArray(result)) {
        throw new Error('Expected array response');
      }

      return { assistantCount: result.length, assistants: result };
    });

    // Test 6: VAPI Credentials Management
    await tester.test('VAPI Credentials Check', async () => {
      const result = await tester.apiCall('/vapi/credentials', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userToken}`
        }
      });

      // Should return credentials status
      return result;
    });

    // Test 7: Dashboard Overview
    await tester.test('Dashboard Overview', async () => {
      const result = await tester.apiCall('/dashboard/overview', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userToken}`
        }
      });

      if (!result.overview) {
        throw new Error('Missing overview data');
      }

      return {
        hasUser: !!result.overview.user,
        hasStats: !!result.overview.stats,
        hasSetup: !!result.overview.setup
      };
    });

    // Test 8: Admin Users List (admin only)
    await tester.test('Admin Users List', async () => {
      const result = await tester.apiCall('/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      if (!Array.isArray(result)) {
        throw new Error('Expected array response');
      }

      return { userCount: result.length };
    });

    // Test 9: Invalid Token Handling
    await tester.test('Invalid Token Handling', async () => {
      try {
        await tester.apiCall('/dashboard/overview', {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer invalid-token'
          }
        });
        throw new Error('Should have failed with invalid token');
      } catch (error) {
        if (error.message.includes('HTTP 401')) {
          return { properly_rejected: true };
        }
        throw error;
      }
    });

    // Test 10: CORS Headers
    await tester.test('CORS Headers', async () => {
      const response = await fetch(`${BASE_URL}/auth/admin-login`, {
        method: 'OPTIONS'
      });

      const corsHeader = response.headers.get('Access-Control-Allow-Origin');
      if (corsHeader !== '*') {
        throw new Error('CORS not properly configured');
      }

      return { cors_enabled: true };
    });

  } catch (error) {
    console.error('❌ Critical test failure:', error);
  }

  tester.printResults();
  return tester.results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  console.log('🚀 Starting Voice Matrix Backend API Tests...\n');
  runTests().then(() => {
    console.log('\n✅ Backend API tests completed!');
  }).catch(console.error);
}

module.exports = { runTests, APITester };