const AWS = require('aws-sdk');
const crypto = require('crypto');

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: process.env.REGION });
const USERS_TABLE = process.env.USERS_TABLE;
const PHONE_NUMBERS_TABLE = process.env.PHONE_NUMBERS_TABLE || 'voice-matrix-phone-numbers';

// Admin's VAPI API key for all operations
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';
const TWILIO_CREDENTIAL_ID = process.env.TWILIO_CREDENTIAL_ID;

// Encryption utilities
function encrypt(text) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32);
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipher(algorithm, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Helper function to call VAPI API
async function callVapiApi(endpoint, method = 'GET', body = null) {
  const fetch = (await import('node-fetch')).default;
  
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${VAPI_BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VAPI API Error: ${response.status} - ${error}`);
  }

  return await response.json();
}

// Create phone number in VAPI and link to customer
exports.createPhoneNumber = async (event) => {
  console.log('📱 Creating phone number:', JSON.stringify(event, null, 2));

  try {
    // Get user ID from Cognito claims
    const userId = event.requestContext.authorizer.claims.sub;
    const userName = event.requestContext.authorizer.claims['cognito:username'] || 
                     event.requestContext.authorizer.claims.email;

    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Unauthorized - no user ID' })
      };
    }

    const requestBody = JSON.parse(event.body);
    const { number, provider = 'twilio', customerId, assistantId } = requestBody;

    // Validate required fields
    if (!number) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Phone number is required' })
      };
    }

    // Check if user already has a phone number
    const existingUser = await dynamodb.get({
      TableName: USERS_TABLE,
      Key: { userId }
    }).promise();

    if (existingUser.Item && existingUser.Item.phoneNumberId) {
      return {
        statusCode: 409,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          error: 'User already has a phone number assigned',
          existingNumber: existingUser.Item.phoneNumber
        })
      };
    }

    // Prepare VAPI phone number creation request
    let vapiRequest = {};

    if (provider === 'twilio') {
      // For Twilio, we need the credential ID from environment or config
      vapiRequest = {
        provider: 'twilio',
        number: number,
        credentialId: process.env.TWILIO_CREDENTIAL_ID // You'll need to set this
      };
    } else if (provider === 'vapi') {
      vapiRequest = {
        provider: 'vapi',
        number: number
      };
    } else {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Unsupported provider' })
      };
    }

    // If assistant ID is provided, link it
    if (assistantId) {
      vapiRequest.assistantId = assistantId;
    }

    console.log('🔄 Creating phone number in VAPI:', vapiRequest);

    // Create phone number in VAPI
    const vapiResponse = await callVapiApi('/phone-number', 'POST', vapiRequest);

    console.log('✅ VAPI phone number created:', vapiResponse);

    // Store phone number info in DynamoDB
    const phoneNumberRecord = {
      phoneNumberId: vapiResponse.id,
      userId: userId,
      userName: userName,
      phoneNumber: number,
      provider: provider,
      vapiData: vapiResponse,
      createdAt: new Date().toISOString(),
      status: 'active',
      assistantId: assistantId || null
    };

    // Save to phone numbers table
    await dynamodb.put({
      TableName: PHONE_NUMBERS_TABLE,
      Item: phoneNumberRecord
    }).promise();

    // Update user record with phone number reference
    await dynamodb.update({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'SET phoneNumberId = :phoneId, phoneNumber = :phoneNumber, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':phoneId': vapiResponse.id,
        ':phoneNumber': number,
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    console.log('✅ Phone number provisioned successfully for user:', userId);

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        id: vapiResponse.id,
        phoneNumber: number,
        provider: provider,
        status: 'active',
        message: 'Phone number created successfully'
      })
    };

  } catch (error) {
    console.error('❌ Error creating phone number:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to create phone number',
        message: error.message
      })
    };
  }
};

// Get user's phone number details
exports.getPhoneNumber = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Get user's phone number from DynamoDB
    const result = await dynamodb.query({
      TableName: PHONE_NUMBERS_TABLE,
      IndexName: 'userId-index',
      KeyConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    if (result.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'No phone number found for user' })
      };
    }

    const phoneRecord = result.Items[0];

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: phoneRecord.phoneNumberId,
        phoneNumber: phoneRecord.phoneNumber,
        provider: phoneRecord.provider,
        status: phoneRecord.status,
        assistantId: phoneRecord.assistantId,
        createdAt: phoneRecord.createdAt
      })
    };

  } catch (error) {
    console.error('❌ Error getting phone number:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to get phone number',
        message: error.message
      })
    };
  }
};

// Update phone number (link to assistant, etc.)
exports.updatePhoneNumber = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const phoneNumberId = event.pathParameters.phoneNumberId;
    const requestBody = JSON.parse(event.body);

    if (!userId || !phoneNumberId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Update in VAPI if needed
    if (requestBody.assistantId) {
      await callVapiApi(`/phone-number/${phoneNumberId}`, 'PATCH', {
        assistantId: requestBody.assistantId
      });
    }

    // Update in DynamoDB
    await dynamodb.update({
      TableName: PHONE_NUMBERS_TABLE,
      Key: { phoneNumberId },
      UpdateExpression: 'SET assistantId = :assistantId, updatedAt = :updatedAt',
      ConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':assistantId': requestBody.assistantId,
        ':updatedAt': new Date().toISOString(),
        ':userId': userId
      }
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Phone number updated successfully'
      })
    };

  } catch (error) {
    console.error('❌ Error updating phone number:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to update phone number',
        message: error.message
      })
    };
  }
};

// Delete phone number
exports.deletePhoneNumber = async (event) => {
  try {
    const userId = event.requestContext.authorizer.claims.sub;
    const phoneNumberId = event.pathParameters.phoneNumberId;

    if (!userId || !phoneNumberId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Delete from VAPI
    await callVapiApi(`/phone-number/${phoneNumberId}`, 'DELETE');

    // Delete from DynamoDB
    await dynamodb.delete({
      TableName: PHONE_NUMBERS_TABLE,
      Key: { phoneNumberId },
      ConditionExpression: 'userId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      }
    }).promise();

    // Remove from user record
    await dynamodb.update({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: 'REMOVE phoneNumberId, phoneNumber SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString()
      }
    }).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Phone number deleted successfully'
      })
    };

  } catch (error) {
    console.error('❌ Error deleting phone number:', error);

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Failed to delete phone number',
        message: error.message
      })
    };
  }
};