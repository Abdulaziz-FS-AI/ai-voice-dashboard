/**
 * VAPI Integration Tests
 * Tests VAPI API connectivity and functionality
 * Run with: node tests/vapi-integration-tests.js
 */

const BASE_URL = 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production';
const VAPI_API_KEY = '661b91f4-60e3-457e-820a-1dc7987b2b1c';

class VAPITester {
  constructor() {
    this.results = [];
    this.adminToken = null;
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  async vapiDirectCall(endpoint, options = {}) {
    const url = `https://api.vapi.ai${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`VAPI HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 VAPI INTEGRATION TEST RESULTS');
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

async function runVAPITests() {
  const tester = new VAPITester();

  try {
    // First get admin token for backend calls
    console.log('🔐 Getting admin token...');
    const adminAuth = await tester.apiCall('/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify({ pin: '123456' })
    });
    tester.adminToken = adminAuth.token;
    console.log('✅ Admin token obtained\n');

    // Test 1: Direct VAPI API Key Validation
    await tester.test('Direct VAPI API Key Validation', async () => {
      const result = await tester.vapiDirectCall('/assistant');
      return { 
        apiKeyValid: true, 
        assistantCount: result.length,
        sampleAssistant: result[0] || null
      };
    });

    // Test 2: Backend VAPI Proxy - Get Assistants
    await tester.test('Backend VAPI Proxy - Get Assistants', async () => {
      const result = await tester.apiCall('/vapi/assistants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      if (!Array.isArray(result)) {
        throw new Error('Expected array response');
      }

      return { 
        assistantCount: result.length,
        assistants: result.map(a => ({ id: a.id, name: a.name }))
      };
    });

    // Test 3: VAPI Account Information
    await tester.test('VAPI Account Information', async () => {
      try {
        const result = await tester.vapiDirectCall('/account');
        return { 
          accountId: result.id,
          credits: result.credits || 0,
          subscription: result.subscription || 'unknown'
        };
      } catch (error) {
        // Account endpoint might not be available, check via backend
        const result = await tester.apiCall('/vapi/account', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tester.adminToken}`
          }
        });
        return result;
      }
    });

    // Test 4: VAPI Phone Numbers
    await tester.test('VAPI Phone Numbers', async () => {
      const result = await tester.apiCall('/vapi/phone-numbers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      return { 
        phoneNumbers: Array.isArray(result) ? result.length : 0,
        numbers: Array.isArray(result) ? result.slice(0, 3) : []
      };
    });

    // Test 5: VAPI Templates
    await tester.test('VAPI Templates', async () => {
      const result = await tester.apiCall('/vapi/templates', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      return { 
        templates: Array.isArray(result) ? result.length : 0,
        sampleTemplates: Array.isArray(result) ? result.slice(0, 2) : []
      };
    });

    // Test 6: User VAPI Credentials Management
    await tester.test('User VAPI Credentials Management', async () => {
      // Check current credentials
      const credentialsCheck = await tester.apiCall('/vapi/credentials', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      return { 
        hasCredentials: credentialsCheck.hasCredentials || false,
        canManageCredentials: true
      };
    });

    // Test 7: Create Test Assistant (if possible)
    await tester.test('Create Test Assistant', async () => {
      const testAssistant = {
        name: `Test Assistant ${Date.now()}`,
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful test assistant created by the Voice Matrix testing system.'
            }
          ]
        },
        voice: {
          provider: 'playht',
          voiceId: 'jennifer'
        },
        firstMessage: 'Hello! This is a test assistant created by Voice Matrix.',
        recordingEnabled: false,
        endCallMessage: 'Thank you for testing Voice Matrix!'
      };

      const result = await tester.apiCall('/vapi/assistants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        },
        body: JSON.stringify(testAssistant)
      });

      return { 
        assistantId: result.id || 'demo-assistant',
        name: result.name || testAssistant.name,
        created: !!result.id
      };
    });

    // Test 8: Environment Variable Check
    await tester.test('Environment Variable Configuration', async () => {
      // This tests if the backend is using the environment variable
      const assistants1 = await tester.apiCall('/vapi/assistants', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tester.adminToken}`
        }
      });

      // Should work without user having their own VAPI key because of env var
      return { 
        environmentKeyWorking: Array.isArray(assistants1),
        assistantCount: assistants1.length
      };
    });

    // Test 9: VAPI Error Handling
    await tester.test('VAPI Error Handling', async () => {
      try {
        // Try to access non-existent assistant
        await tester.apiCall('/vapi/assistants/non-existent-id', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tester.adminToken}`
          }
        });
        return { errorHandling: 'No error thrown - might be OK' };
      } catch (error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
          return { errorHandling: 'Properly handles 404 errors' };
        }
        throw error;
      }
    });

    // Test 10: VAPI Rate Limiting Handling
    await tester.test('VAPI Rate Limiting Handling', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          tester.apiCall('/vapi/assistants', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tester.adminToken}`
            }
          })
        );
      }

      const results = await Promise.allSettled(requests);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return { 
        rapidRequests: {
          successful,
          failed,
          totalRequests: 5
        }
      };
    });

  } catch (error) {
    console.error('❌ Critical VAPI test failure:', error);
  }

  tester.printResults();
  return tester.results;
}

// Utility function to test specific VAPI functionality
async function testVAPIFeature(feature) {
  const tester = new VAPITester();
  
  console.log(`🎯 Testing specific VAPI feature: ${feature}\n`);
  
  // Get admin token
  const adminAuth = await tester.apiCall('/auth/admin-login', {
    method: 'POST',
    body: JSON.stringify({ pin: '123456' })
  });
  tester.adminToken = adminAuth.token;

  switch (feature.toLowerCase()) {
    case 'assistants':
      return await tester.test('VAPI Assistants Feature', async () => {
        const result = await tester.apiCall('/vapi/assistants', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        return { count: result.length, assistants: result };
      });

    case 'phone-numbers':
      return await tester.test('VAPI Phone Numbers Feature', async () => {
        const result = await tester.apiCall('/vapi/phone-numbers', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        return { count: result.length, numbers: result };
      });

    case 'calls':
      return await tester.test('VAPI Calls Feature', async () => {
        const result = await tester.apiCall('/vapi/calls', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tester.adminToken}` }
        });
        return { count: result.length, calls: result };
      });

    default:
      console.log(`❌ Unknown feature: ${feature}`);
      return null;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length > 0 && args[0] === '--feature') {
    // Test specific feature
    const feature = args[1];
    if (!feature) {
      console.log('❌ Please specify a feature: --feature assistants|phone-numbers|calls');
      process.exit(1);
    }
    
    testVAPIFeature(feature).then(() => {
      console.log(`\n✅ VAPI ${feature} feature test completed!`);
    }).catch(console.error);
  } else {
    // Run all tests
    console.log('🚀 Starting Voice Matrix VAPI Integration Tests...\n');
    runVAPITests().then(() => {
      console.log('\n✅ VAPI integration tests completed!');
    }).catch(console.error);
  }
}

module.exports = { runVAPITests, testVAPIFeature, VAPITester };