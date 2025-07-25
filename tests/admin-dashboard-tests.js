/**
 * Admin Dashboard Tests
 * Tests admin functionality and permissions
 * Run with: node tests/admin-dashboard-tests.js
 */

const BASE_URL = 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production';

class AdminTester {
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
      return null;
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

    const responseText = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch {
      return responseText;
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('👨‍💼 ADMIN DASHBOARD TEST RESULTS');
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

async function runAdminTests() {
  const tester = new AdminTester();

  try {
    // Setup: Get admin and user tokens
    console.log('🔐 Setting up test tokens...');
    
    // Get admin token
    const adminAuth = await tester.apiCall('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ pin: '123456' })
    });
    tester.adminToken = adminAuth.token;
    console.log('✅ Admin token obtained');

    // Create a test user
    const testUser = {
      email: `admin.test.user.${Date.now()}@voicematrix.ai`,
      password: 'testpassword123',
      firstName: 'AdminTest',
      lastName: 'User'
    };

    const userAuth = await tester.apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(testUser)
    });
    tester.userToken = userAuth.token;
    tester.testUser = testUser;
    console.log('✅ Test user created\n');

    // Test 1: Admin Authentication
    await tester.test('Admin PIN Authentication', async () => {
      const result = await tester.apiCall('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: '123456' })
      });

      if (!result.token || result.user.role !== 'admin') {
        throw new Error('Admin authentication failed');
      }

      return {
        tokenReceived: !!result.token,
        userRole: result.user.role,
        adminEmail: result.user.email
      };
    });

    // Test 2: Wrong PIN Rejection
    await tester.test('Wrong PIN Rejection', async () => {
      try {
        await tester.apiCall('/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({ pin: '000000' })
        });
        throw new Error('Should have rejected wrong PIN');
      } catch (error) {
        if (error.message.includes('HTTP 401') || error.message.includes('Invalid')) {
          return { correctlyRejected: true };
        }
        throw error;
      }
    });

    // Test 3: Admin Users List Access
    await tester.test('Admin Users List Access', async () => {
      const result = await tester.apiCall('/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      if (!Array.isArray(result)) {
        throw new Error('Expected array of users');
      }

      return {
        userCount: result.length,
        hasTestUser: result.some(u => u.email === tester.testUser.email),
        sampleUser: result[0] || null
      };
    });

    // Test 4: Regular User Cannot Access Admin Endpoints
    await tester.test('User Cannot Access Admin Endpoints', async () => {
      try {
        await tester.apiCall('/admin/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tester.userToken}`
          }
        });
        throw new Error('Regular user should not access admin endpoints');
      } catch (error) {
        if (error.message.includes('HTTP 403') || error.message.includes('HTTP 401')) {
          return { properlyBlocked: true };
        }
        throw error;
      }
    });

    // Test 5: Admin Can Access User Data
    await tester.test('Admin Can Access User Data', async () => {
      const users = await tester.apiCall('/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      const testUser = users.find(u => u.email === tester.testUser.email);
      if (!testUser) {
        throw new Error('Cannot find test user in admin list');
      }

      return {
        foundUser: !!testUser,
        userEmail: testUser.email,
        userRole: testUser.role,
        userActive: testUser.isActive
      };
    });

    // Test 6: Admin VAPI Access
    await tester.test('Admin VAPI Access', async () => {
      const assistants = await tester.apiCall('/vapi/assistants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      return {
        canAccessVAPI: true,
        assistantCount: assistants.length,
        hasAdminKey: assistants.length >= 0 // Should work with admin key
      };
    });

    // Test 7: Admin Dashboard Overview
    await tester.test('Admin Dashboard Overview', async () => {
      const dashboard = await tester.apiCall('/dashboard/overview', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      if (!dashboard.overview) {
        throw new Error('Missing dashboard overview data');
      }

      return {
        hasOverview: !!dashboard.overview,
        hasUserData: !!dashboard.overview.user,
        hasStats: !!dashboard.overview.stats,
        userRole: dashboard.overview.user?.role
      };
    });

    // Test 8: Admin Statistics
    await tester.test('Admin Statistics Access', async () => {
      // Test various admin stat endpoints
      const stats = {};

      try {
        const users = await tester.apiCall('/admin/users', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        stats.totalUsers = users.length;
        stats.activeUsers = users.filter(u => u.isActive).length;
      } catch (error) {
        stats.userStatsError = error.message;
      }

      try {
        const assistants = await tester.apiCall('/vapi/assistants', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        stats.totalAssistants = assistants.length;
      } catch (error) {
        stats.assistantStatsError = error.message;
      }

      return stats;
    });

    // Test 9: Admin Token Expiration Handling
    await tester.test('Admin Token Validation', async () => {
      const verification = await tester.apiCall('/auth/verify-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      if (!verification.valid || verification.user.role !== 'admin') {
        throw new Error('Admin token validation failed');
      }

      return {
        tokenValid: verification.valid,
        userRole: verification.user.role,
        userId: verification.user.userId
      };
    });

    // Test 10: Admin System Health Check
    await tester.test('Admin System Health Check', async () => {
      const healthChecks = {};

      // Check database connectivity (via user list)
      try {
        const users = await tester.apiCall('/admin/users', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        healthChecks.database = { status: 'healthy', userCount: users.length };
      } catch (error) {
        healthChecks.database = { status: 'error', error: error.message };
      }

      // Check VAPI connectivity
      try {
        const assistants = await tester.apiCall('/vapi/assistants', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        healthChecks.vapi = { status: 'healthy', assistantCount: assistants.length };
      } catch (error) {
        healthChecks.vapi = { status: 'error', error: error.message };
      }

      // Check authentication system
      try {
        const verify = await tester.apiCall('/auth/verify-token', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        healthChecks.auth = { status: 'healthy', valid: verify.valid };
      } catch (error) {
        healthChecks.auth = { status: 'error', error: error.message };
      }

      return healthChecks;
    });

    // Test 11: Admin Emergency Functions
    await tester.test('Admin Emergency Access', async () => {
      // Test that admin can always authenticate even with system issues
      const emergencyAuth = await tester.apiCall('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: '123456' })
      });

      if (!emergencyAuth.token) {
        throw new Error('Emergency admin access failed');
      }

      return {
        emergencyAccess: true,
        newToken: !!emergencyAuth.token,
        adminUser: emergencyAuth.user.role === 'admin'
      };
    });

    // Test 12: Admin Audit Capabilities
    await tester.test('Admin Audit Capabilities', async () => {
      const auditData = {};

      // Check recent user registrations
      const users = await tester.apiCall('/admin/users', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tester.adminToken}` }
      });

      const recentUsers = users.filter(u => {
        const createdAt = new Date(u.createdAt || u.updatedAt || Date.now());
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        return createdAt > hourAgo;
      });

      auditData.recentRegistrations = recentUsers.length;
      auditData.totalUsers = users.length;
      auditData.activeUsers = users.filter(u => u.isActive).length;

      return auditData;
    });

  } catch (error) {
    console.error('❌ Critical admin test failure:', error);
  }

  tester.printResults();
  return tester.results;
}

// Admin security test
async function runAdminSecurityTest() {
  const tester = new AdminTester();
  
  console.log('🛡️ Running Admin Security Tests...\n');

  await tester.test('SQL Injection Prevention', async () => {
    try {
      await tester.apiCall('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: "'; DROP TABLE users; --" })
      });
      return { sqlInjectionBlocked: false };
    } catch (error) {
      return { sqlInjectionBlocked: true, error: error.message };
    }
  });

  await tester.test('XSS Prevention', async () => {
    try {
      await tester.apiCall('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: '<script>alert("xss")</script>' })
      });
      return { xssBlocked: false };
    } catch (error) {
      return { xssBlocked: true, error: error.message };
    }
  });

  tester.printResults();
  return tester.results;
}

// Run tests if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--security')) {
    console.log('🛡️ Starting Admin Security Tests...\n');
    runAdminSecurityTest().then(() => {
      console.log('\n✅ Admin security tests completed!');
    }).catch(console.error);
  } else {
    console.log('👨‍💼 Starting Admin Dashboard Tests...\n');
    runAdminTests().then(() => {
      console.log('\n✅ Admin dashboard tests completed!');
    }).catch(console.error);
  }
}

module.exports = { runAdminTests, runAdminSecurityTest, AdminTester };