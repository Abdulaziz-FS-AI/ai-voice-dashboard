const axios = require('axios');

// Test configuration
const API_BASE_URL = 'https://w60nq0gwb5.execute-api.eu-north-1.amazonaws.com/prod';
const VAPI_API_KEY = '661b91f4-60e3-457e-820a-1dc7987b2b1c';

// Test data for creating an assistant
const testAssistant = {
  name: 'Test Sales Assistant',
  customConfig: {
    model: {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful sales assistant for testing purposes. Keep responses brief and professional.'
        }
      ]
    },
    voice: {
      provider: 'playht',
      voiceId: 'jennifer'
    },
    firstMessage: 'Hello! This is a test assistant. How can I help you today?',
    recordingEnabled: true
  }
};

// Test function to create assistant directly with VAPI
async function testDirectVAPICall() {
  try {
    console.log('🧪 Testing direct VAPI API call...');
    
    const response = await axios.post('https://api.vapi.ai/assistant', {
      name: 'Test Assistant - Direct',
      model: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a test assistant created directly via VAPI API.'
          }
        ]
      },
      voice: {
        provider: 'playht',
        voiceId: 'jennifer'
      },
      firstMessage: 'Hello! I am a test assistant.',
      recordingEnabled: true
    }, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Direct VAPI call successful!');
    console.log('Assistant created:', response.data);
    
    // Test getting the assistant
    const getResponse = await axios.get(`https://api.vapi.ai/assistant/${response.data.id}`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Retrieved assistant:', getResponse.data.name);
    
    // Test updating the assistant
    const updateResponse = await axios.patch(`https://api.vapi.ai/assistant/${response.data.id}`, {
      name: 'Updated Test Assistant'
    }, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Updated assistant:', updateResponse.data.name);
    
    // Test deleting the assistant
    await axios.delete(`https://api.vapi.ai/assistant/${response.data.id}`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Deleted assistant successfully');
    
    return response.data;
  } catch (error) {
    console.error('❌ Direct VAPI call failed:', error.response?.data || error.message);
    throw error;
  }
}

// Test function to list all assistants
async function testListAssistants() {
  try {
    console.log('📋 Testing list assistants...');
    
    const response = await axios.get('https://api.vapi.ai/assistant', {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Found ${response.data.length} assistants in VAPI account`);
    response.data.forEach((assistant, index) => {
      console.log(`  ${index + 1}. ${assistant.name} (ID: ${assistant.id})`);
    });
    
    return response.data;
  } catch (error) {
    console.error('❌ List assistants failed:', error.response?.data || error.message);
    throw error;
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting VAPI API Tests\n');
  
  try {
    // Test 1: List existing assistants
    await testListAssistants();
    console.log('');
    
    // Test 2: Test direct VAPI CRUD operations
    await testDirectVAPICall();
    console.log('');
    
    console.log('🎉 All tests passed! VAPI integration is working correctly.');
    
  } catch (error) {
    console.error('❌ Tests failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
runTests();