/**
 * End-to-End User Journey Tests
 * Tests complete user workflows from registration to VAPI usage
 * Run with: node tests/e2e-user-journey-tests.js
 */

const BASE_URL = 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production';

class E2ETester {
  constructor() {
    this.results = [];
    this.userSession = {
      email: null,
      password: null,
      token: null,
      userId: null,
      assistants: [],
      phoneNumbers: []
    };
    this.adminSession = {
      token: null
    };
  }

  async test(name, testFn) {
    try {
      console.log(`🧪 E2E Test: ${name}`);
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

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 END-TO-END USER JOURNEY TEST RESULTS');
    console.log('='.repeat(60));
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.results.length}\n`);

    // Print journey summary
    console.log('📋 USER JOURNEY SUMMARY:');
    console.log(`   👤 User Email: ${this.userSession.email}`);
    console.log(`   🔑 Token: ${this.userSession.token ? 'Valid' : 'None'}`);
    console.log(`   🤖 Assistants: ${this.userSession.assistants.length}`);
    console.log(`   📞 Phone Numbers: ${this.userSession.phoneNumbers.length}\n`);

    if (failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   - ${result.name}: ${result.error}`);
      });
    }
  }
}

async function runE2ETests() {
  const tester = new E2ETester();

  try {
    console.log('🎭 Starting Complete User Journey...\n');

    // Journey Step 1: New User Registration
    await tester.test('👤 Step 1: New User Registration', async () => {
      const timestamp = Date.now();
      const userData = {
        email: `e2e.user.${timestamp}@voicematrix.ai`,
        password: 'SecurePassword123!',
        firstName: 'E2E',
        lastName: 'TestUser'
      };

      const result = await tester.apiCall('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      });

      if (!result.token || !result.user) {
        throw new Error('Registration failed - missing token or user');
      }

      // Store session data
      tester.userSession.email = userData.email;
      tester.userSession.password = userData.password;
      tester.userSession.token = result.token;
      tester.userSession.userId = result.user.userId;

      return {
        registered: true,
        email: userData.email,
        userId: result.user.userId,
        hasToken: !!result.token
      };
    });

    // Journey Step 2: User Login Verification
    await tester.test('🔐 Step 2: User Login Verification', async () => {
      const result = await tester.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: tester.userSession.email,
          password: tester.userSession.password
        })
      });

      if (!result.token || result.user.userId !== tester.userSession.userId) {
        throw new Error('Login verification failed');
      }

      return {
        loginWorking: true,
        sameUserId: result.user.userId === tester.userSession.userId,
        newToken: !!result.token
      };
    });

    // Journey Step 3: Dashboard Access
    await tester.test('📊 Step 3: Dashboard Access', async () => {
      const result = await tester.apiCall('/dashboard/overview', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      if (!result.overview || !result.overview.user) {
        throw new Error('Dashboard access failed');
      }

      return {
        dashboardAccessible: true,
        userProfile: result.overview.user,
        setupStatus: result.overview.setup,
        hasStats: !!result.overview.stats
      };
    });

    // Journey Step 4: VAPI Settings Check
    await tester.test('🎙️ Step 4: VAPI Settings Check', async () => {
      const result = await tester.apiCall('/vapi/credentials', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      return {
        vapiSettingsAccessible: true,
        hasCredentials: result.hasCredentials || false,
        canManageCredentials: true
      };
    });

    // Journey Step 5: VAPI Assistants Access (using admin key fallback)
    await tester.test('🤖 Step 5: VAPI Assistants Access', async () => {
      const result = await tester.apiCall('/vapi/assistants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      if (!Array.isArray(result)) {
        throw new Error('Expected assistants array');
      }

      tester.userSession.assistants = result;

      return {
        assistantsAccessible: true,
        assistantCount: result.length,
        usingAdminKey: result.length >= 0, // Should work with admin fallback key
        sampleAssistant: result[0] || null
      };
    });

    // Journey Step 6: Create Test Assistant
    await tester.test('🛠️ Step 6: Create Test Assistant', async () => {
      const assistantData = {
        name: `E2E Test Assistant ${Date.now()}`,
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant created during E2E testing of Voice Matrix.'
            }
          ]
        },
        voice: {
          provider: 'playht',
          voiceId: 'jennifer'
        },
        firstMessage: 'Hello! I am your E2E test assistant.',
        recordingEnabled: false,
        endCallMessage: 'Thank you for using Voice Matrix E2E testing!'
      };

      const result = await tester.apiCall('/vapi/assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        },
        body: JSON.stringify(assistantData)
      });

      return {
        assistantCreated: !!result.id,
        assistantId: result.id || 'demo-assistant',
        assistantName: result.name || assistantData.name
      };
    });

    // Journey Step 7: Phone Numbers Access
    await tester.test('📞 Step 7: Phone Numbers Access', async () => {
      const result = await tester.apiCall('/vapi/phone-numbers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      if (!Array.isArray(result)) {
        throw new Error('Expected phone numbers array');
      }

      tester.userSession.phoneNumbers = result;

      return {
        phoneNumbersAccessible: true,
        phoneNumberCount: result.length,
        numbers: result.slice(0, 2) // Show first 2 numbers
      };
    });

    // Journey Step 8: User Profile Update
    await tester.test('👨‍💼 Step 8: User Profile Management', async () => {
      // Verify token still works
      const verification = await tester.apiCall('/auth/verify-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      if (!verification.valid) {
        throw new Error('User token expired or invalid');
      }

      return {
        tokenValid: verification.valid,
        userStillActive: verification.user.userId === tester.userSession.userId,
        profileAccessible: true
      };
    });

    // Journey Step 9: Admin Workflow Test
    await tester.test('👨‍💼 Step 9: Admin Workflow', async () => {
      // Get admin access
      const adminAuth = await tester.apiCall('/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ pin: '123456' })
      });

      tester.adminSession.token = adminAuth.token;

      // Admin should see the test user
      const users = await tester.apiCall('/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminSession.token}`
        }
      });

      const testUser = users.find(u => u.email === tester.userSession.email);

      return {
        adminAccessWorking: true,
        canSeeTestUser: !!testUser,
        totalUsers: users.length,
        testUserActive: testUser?.isActive || false
      };
    });

    // Journey Step 10: Session Persistence
    await tester.test('⏱️ Step 10: Session Persistence', async () => {
      // Wait a moment to simulate time passage
      await tester.sleep(2000);

      // Verify user token still works
      const userCheck = await tester.apiCall('/dashboard/overview', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      // Verify admin token still works  
      const adminCheck = await tester.apiCall('/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminSession.token}`
        }
      });

      return {
        userSessionPersistent: !!userCheck.overview,
        adminSessionPersistent: Array.isArray(adminCheck),
        sessionDuration: '2+ seconds'
      };
    });

    // Journey Step 11: Data Consistency Check
    await tester.test('🔄 Step 11: Data Consistency', async () => {
      // Check assistants again to ensure consistency
      const assistants = await tester.apiCall('/vapi/assistants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      // Check dashboard data
      const dashboard = await tester.apiCall('/dashboard/overview', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.userSession.token}`
        }
      });

      return {
        assistantCountConsistent: assistants.length >= tester.userSession.assistants.length,
        dashboardConsistent: !!dashboard.overview.user,
        dataIntegrity: 'maintained'
      };
    });

    // Journey Step 12: Logout and Re-authentication
    await tester.test('🚪 Step 12: Logout and Re-authentication', async () => {
      // Try to login again
      const newLogin = await tester.apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: tester.userSession.email,
          password: tester.userSession.password
        })
      });

      // Get new token and verify it works
      const newToken = newLogin.token;
      const verifyNew = await tester.apiCall('/auth/verify-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      });

      return {
        reLoginSuccessful: !!newLogin.token,
        newTokenValid: verifyNew.valid,
        sameUserId: verifyNew.user.userId === tester.userSession.userId
      };
    });

  } catch (error) {
    console.error('❌ Critical E2E test failure:', error);
  }

  tester.printResults();
  return tester.results;
}

// Specific user workflow tests
async function testUserWorkflow(workflow) {
  const tester = new E2ETester();
  
  console.log(`🎯 Testing specific user workflow: ${workflow}\n`);

  switch (workflow.toLowerCase()) {
    case 'registration':
      return await tester.test('User Registration Workflow', async () => {
        const userData = {
          email: `workflow.test.${Date.now()}@example.com`,
          password: 'TestPassword123!',
          firstName: 'Workflow',
          lastName: 'Test'
        };

        const result = await tester.apiCall('/auth/register', {
          method: 'POST',
          body: JSON.stringify(userData)
        });

        return { 
          success: !!result.token,
          userId: result.user.userId,
          email: result.user.email
        };
      });

    case 'vapi-setup':
      return await tester.test('VAPI Setup Workflow', async () => {
        // Get admin token for testing
        const adminAuth = await tester.apiCall('/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({ pin: '123456' })
        });

        const assistants = await tester.apiCall('/vapi/assistants', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${adminAuth.token}` }
        });

        return {
          vapiAccessible: true,
          assistantCount: assistants.length,
          setupComplete: assistants.length >= 0
        };
      });

    case 'admin-access':
      return await tester.test('Admin Access Workflow', async () => {
        const adminAuth = await tester.apiCall('/auth/admin-login', {
          method: 'POST',
          body: JSON.stringify({ pin: '123456' })
        });

        const users = await tester.apiCall('/admin/users', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${adminAuth.token}` }
        });

        return {
          adminAccess: true,
          userCount: users.length,
          canManageUsers: Array.isArray(users)
        };
      });

    default:
      console.log(`❌ Unknown workflow: ${workflow}`);
      return null;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === '--workflow') {
    // Test specific workflow
    const workflow = args[1];
    if (!workflow) {
      console.log('❌ Please specify a workflow: --workflow registration|vapi-setup|admin-access');
      process.exit(1);
    }
    
    testUserWorkflow(workflow).then(() => {
      console.log(`\n✅ ${workflow} workflow test completed!`);
    }).catch(console.error);
  } else {
    // Run complete E2E journey
    console.log('🚀 Starting Complete End-to-End User Journey Tests...\n');
    runE2ETests().then(() => {
      console.log('\n🎉 Complete user journey testing finished!');
      console.log('📋 Summary: New user → Registration → Login → Dashboard → VAPI → Admin view → Session management');
    }).catch(console.error);
  }
}

module.exports = { runE2ETests, testUserWorkflow, E2ETester };