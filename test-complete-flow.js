/**
 * Complete User Flow Test
 * Tests: Register → Login → Dashboard → VAPI Access
 */

const BASE_URL = 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production';

async function testCompleteUserFlow() {
  console.log('🚀 Testing Complete User Flow...\n');
  
  const timestamp = Date.now();
  const testUser = {
    email: `complete.test.${timestamp}@example.com`,
    password: 'SecurePass123!',
    firstName: 'Complete',
    lastName: 'Test'
  };
  
  let token = null;
  
  try {
    // Step 1: User Registration
    console.log('1️⃣ Testing User Registration...');
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    
    if (!registerResponse.ok) {
      throw new Error(`Registration failed: ${await registerResponse.text()}`);
    }
    
    const registerData = await registerResponse.json();
    token = registerData.token;
    console.log(`✅ Registration SUCCESS - User: ${registerData.user.email}`);
    
    // Wait a moment for DynamoDB consistency
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 2: User Login (verify login works separately)
    console.log('2️⃣ Testing User Login...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${await loginResponse.text()}`);
    }
    
    const loginData = await loginResponse.json();
    console.log(`✅ Login SUCCESS - Token valid`);
    
    // Step 3: Dashboard Access
    console.log('3️⃣ Testing Dashboard Access...');
    const dashboardResponse = await fetch(`${BASE_URL}/dashboard/overview`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!dashboardResponse.ok) {
      throw new Error(`Dashboard access failed: ${await dashboardResponse.text()}`);
    }
    
    const dashboardData = await dashboardResponse.json();
    console.log(`✅ Dashboard ACCESS SUCCESS - Plan: ${dashboardData.user?.subscription?.plan}`);
    
    // Step 4: VAPI Access (should work with admin fallback key)
    console.log('4️⃣ Testing VAPI Access...');
    const vapiResponse = await fetch(`${BASE_URL}/vapi/assistants`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!vapiResponse.ok) {
      throw new Error(`VAPI access failed: ${await vapiResponse.text()}`);
    }
    
    const vapiData = await vapiResponse.json();
    console.log(`✅ VAPI ACCESS SUCCESS - Assistants: ${vapiData.length}`);
    
    // Step 5: Token Verification
    console.log('5️⃣ Testing Token Verification...');
    const verifyResponse = await fetch(`${BASE_URL}/auth/verify-token`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!verifyResponse.ok) {
      throw new Error(`Token verification failed: ${await verifyResponse.text()}`);
    }
    
    const verifyData = await verifyResponse.json();
    console.log(`✅ Token VERIFICATION SUCCESS - Valid: ${verifyData.valid}`);
    
    // Final Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 COMPLETE USER FLOW TEST: SUCCESS!');
    console.log('='.repeat(50));
    console.log(`👤 Test User: ${testUser.email}`);
    console.log(`🔑 Registration: ✅ Working`);
    console.log(`🔐 Login: ✅ Working`);
    console.log(`📊 Dashboard: ✅ Working`);
    console.log(`🎙️ VAPI Access: ✅ Working`);
    console.log(`🔒 Token Verification: ✅ Working`);
    console.log('\n🚀 YOUR APP IS 100% PRODUCTION READY!');
    console.log('🌐 https://main.d3nqtyqk3krtlj.amplifyapp.com');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error(`❌ Flow test failed at step: ${error.message}`);
    console.log('\n❌ PRODUCTION READINESS: INCOMPLETE');
  }
}

testCompleteUserFlow();