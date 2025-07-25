/**
 * Quick Test - Verify Core Functionality
 * Tests the most critical features quickly
 */

const BASE_URL = 'https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production';

async function quickTest() {
  console.log('🚀 Voice Matrix Quick Test\n');
  
  const results = [];

  // Test 1: Admin Login
  try {
    console.log('🧪 Testing Admin Login...');
    const response = await fetch(`${BASE_URL}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '123456' })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Admin Login: SUCCESS');
      results.push({ test: 'Admin Login', status: 'PASS' });
      
      // Test 2: VAPI Assistants with admin token
      try {
        console.log('🧪 Testing VAPI Assistants...');
        const vapiResponse = await fetch(`${BASE_URL}/vapi/assistants`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${data.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (vapiResponse.ok) {
          const assistants = await vapiResponse.json();
          console.log(`✅ VAPI Assistants: SUCCESS (Found ${assistants.length} assistants)`);
          results.push({ test: 'VAPI Assistants', status: 'PASS', count: assistants.length });
        } else {
          console.log('❌ VAPI Assistants: FAILED');
          results.push({ test: 'VAPI Assistants', status: 'FAIL' });
        }
      } catch (error) {
        console.log(`❌ VAPI Assistants: ERROR - ${error.message}`);
        results.push({ test: 'VAPI Assistants', status: 'ERROR', error: error.message });
      }
      
      // Test 3: Dashboard Overview
      try {
        console.log('🧪 Testing Dashboard...');
        const dashResponse = await fetch(`${BASE_URL}/dashboard/overview`, {
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${data.token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (dashResponse.ok) {
          const dashboard = await dashResponse.json();
          console.log('✅ Dashboard: SUCCESS');
          results.push({ test: 'Dashboard', status: 'PASS' });
        } else {
          console.log('❌ Dashboard: FAILED');
          results.push({ test: 'Dashboard', status: 'FAIL' });
        }
      } catch (error) {
        console.log(`❌ Dashboard: ERROR - ${error.message}`);
        results.push({ test: 'Dashboard', status: 'ERROR', error: error.message });
      }
      
    } else {
      console.log('❌ Admin Login: FAILED');
      results.push({ test: 'Admin Login', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`❌ Admin Login: ERROR - ${error.message}`);
    results.push({ test: 'Admin Login', status: 'ERROR', error: error.message });
  }

  // Test 4: Frontend Health
  try {
    console.log('🧪 Testing Frontend...');
    const frontendResponse = await fetch('https://main.d3nqtyqk3krtlj.amplifyapp.com');
    if (frontendResponse.ok) {
      console.log('✅ Frontend: SUCCESS');
      results.push({ test: 'Frontend', status: 'PASS' });
    } else {
      console.log('❌ Frontend: FAILED');
      results.push({ test: 'Frontend', status: 'FAIL' });
    }
  } catch (error) {
    console.log(`❌ Frontend: ERROR - ${error.message}`);
    results.push({ test: 'Frontend', status: 'ERROR', error: error.message });
  }
  
  // Summary
  console.log('\n' + '='.repeat(40));
  console.log('📊 QUICK TEST SUMMARY');
  console.log('='.repeat(40));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const errors = results.filter(r => r.status === 'ERROR').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Errors: ${errors}`);
  console.log(`📊 Total: ${results.length}`);
  
  if (passed === results.length) {
    console.log('\n🎉 ALL CORE FEATURES WORKING!');
    console.log('✨ Your Voice Matrix Dashboard is functional!');
  } else {
    console.log('\n⚠️  Some issues detected, but core features may still work');
  }
  
  console.log('\n🔗 Test your app:');
  console.log('   Frontend: https://main.d3nqtyqk3krtlj.amplifyapp.com');
  console.log('   Admin PIN: 123456');
  console.log('   VAPI Key: 661b91f4-60e3-457e-820a-1dc7987b2b1c');
  console.log('='.repeat(40));
}

quickTest().catch(console.error);