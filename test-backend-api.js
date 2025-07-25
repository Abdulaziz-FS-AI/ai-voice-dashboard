const axios = require('axios');

// Test configuration
const API_BASE_URL = 'https://w60nq0gwb5.execute-api.eu-north-1.amazonaws.com/prod';

// Mock JWT token for testing (you'll need to replace this with a real token in production)
const TEST_JWT_TOKEN = 'test-token-for-demo';

// Test function to create assistant via our backend
async function testBackendCreateAssistant() {
  try {
    console.log('🏗️ Testing backend create assistant endpoint...');
    
    const response = await axios.post(`${API_BASE_URL}/vapi/assistants`, {
      name: 'Backend Test Assistant',
      customConfig: {
        model: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a test assistant created via the backend API.'
            }
          ]
        },
        voice: {
          provider: 'playht',
          voiceId: 'jennifer'
        },
        firstMessage: 'Hello! I am a backend test assistant.',
        recordingEnabled: true
      }
    }, {
      headers: {
        'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Backend assistant created:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Backend create failed:', error.response?.data || error.message);
    throw error;
  }
}

// Test function to get assistants via backend
async function testBackendGetAssistants() {
  try {
    console.log('📋 Testing backend get assistants endpoint...');
    
    const response = await axios.get(`${API_BASE_URL}/vapi/assistants`, {
      headers: {
        'Authorization': `Bearer ${TEST_JWT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Backend assistants retrieved:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Backend get failed:', error.response?.data || error.message);
    throw error;
  }
}

// Test function to get assistant templates (no auth required)
async function testBackendGetTemplates() {
  try {
    console.log('📋 Testing backend get templates endpoint...');
    
    const response = await axios.get(`${API_BASE_URL}/vapi/templates`);
    
    console.log('✅ Backend templates retrieved:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Backend templates failed:', error.response?.data || error.message);
    throw error;
  }
}

// Main test function
async function runBackendTests() {
  console.log('🚀 Starting Backend API Tests\n');
  
  try {
    // Test 1: Get templates (no auth)
    await testBackendGetTemplates();
    console.log('');
    
    // Test 2: Get assistants (with auth - may fail without real token)
    try {
      await testBackendGetAssistants();
      console.log('');
    } catch (error) {
      console.log('⚠️ Expected auth failure for get assistants (needs real JWT token)\n');
    }
    
    // Test 3: Create assistant (with auth - may fail without real token)
    try {
      await testBackendCreateAssistant();
      console.log('');
    } catch (error) {
      console.log('⚠️ Expected auth failure for create assistant (needs real JWT token)\n');
    }
    
    console.log('🎉 Backend endpoint tests completed!');
    
  } catch (error) {
    console.error('❌ Backend tests failed:', error.message);
  }
}

// Run the tests
runBackendTests();