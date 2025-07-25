// Debug registration issue
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');  
const { DynamoDBDocumentClient, PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({ region: 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function testRegistration() {
  console.log('🔍 Testing DynamoDB registration manually...');
  
  const testEmail = `debug.test.${Date.now()}@example.com`;
  
  try {
    // Test 1: Check if we can scan the table
    console.log('1. Testing table scan...');
    const scanResult = await docClient.send(new ScanCommand({
      TableName: 'production-voice-matrix-users',
      Limit: 1
    }));
    console.log('✅ Table scan successful, items:', scanResult.Items?.length || 0);
    
    // Test 2: Try to create a user manually
    console.log('2. Testing user creation...');
    const passwordHash = await bcrypt.hash('testpass123', 10);
    const userId = uuidv4();
    const tenantId = uuidv4();
    
    const user = {
      userId,
      email: testEmail,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      tenantId,
      subscription: {
        plan: 'free',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      profile: {
        firstName: 'Debug',
        lastName: 'Test'
      }
    };
    
    await docClient.send(new PutCommand({
      TableName: 'production-voice-matrix-users',
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)'
    }));
    
    console.log('✅ User created successfully!');
    console.log('📧 Email:', testEmail);
    console.log('🆔 User ID:', userId);
    
    // Test 3: Try to find the user by email
    console.log('3. Testing email lookup...');
    const emailResult = await docClient.send(new ScanCommand({
      TableName: 'production-voice-matrix-users',
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': testEmail
      },
      Limit: 1
    }));
    
    if (emailResult.Items && emailResult.Items.length > 0) {
      console.log('✅ Email lookup successful!');
      console.log('👤 Found user:', emailResult.Items[0].email);
    } else {
      console.log('❌ Email lookup failed - user not found');
    }
    
  } catch (error) {
    console.error('❌ Error during manual test:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
  }
}

testRegistration();