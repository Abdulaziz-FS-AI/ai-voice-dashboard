const AWS = require('aws-sdk');
const crypto = require('crypto');
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Encryption helpers
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
    if (!text) return null;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText) {
    if (!encryptedText) return null;
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

exports.saveVapiCredentials = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { apiKey, orgId, phoneNumbers = [] } = JSON.parse(event.body);
        
        if (!apiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key is required' })
            };
        }
        
        // Encrypt the API key
        const encryptedApiKey = encrypt(apiKey);
        
        // Update user record with VAPI credentials
        const updateParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId },
            UpdateExpression: `SET 
                vapiApiKey = :apiKey,
                vapiOrgId = :orgId,
                phoneNumbers = :phoneNumbers,
                vapiConfiguredAt = :timestamp`,
            ExpressionAttributeValues: {
                ':apiKey': encryptedApiKey,
                ':orgId': orgId || null,
                ':phoneNumbers': phoneNumbers,
                ':timestamp': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.update(updateParams).promise();
        
        // Remove sensitive data from response
        const responseUser = { ...result.Attributes };
        delete responseUser.vapiApiKey;
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                message: 'VAPI credentials saved successfully',
                user: responseUser
            })
        };
    } catch (error) {
        console.error('Error saving VAPI credentials:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.getVapiCredentials = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        const params = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (!result.Item) {
            return {
                statusCode: 404,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'User not found' })
            };
        }
        
        const user = result.Item;
        
        // Return user info without exposing the API key
        const response = {
            userId: user.userId,
            email: user.email,
            hasVapiKey: !!user.vapiApiKey,
            vapiOrgId: user.vapiOrgId || null,
            phoneNumbers: user.phoneNumbers || [],
            vapiConfiguredAt: user.vapiConfiguredAt || null,
            assistantIds: user.assistantIds || [],
            lastAssistantSync: user.lastAssistantSync || null
        };
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error getting VAPI credentials:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.removeVapiCredentials = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        const updateParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId },
            UpdateExpression: `REMOVE 
                vapiApiKey,
                vapiOrgId,
                phoneNumbers,
                vapiConfiguredAt,
                assistantIds,
                lastAssistantSync`,
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.update(updateParams).promise();
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                message: 'VAPI credentials removed successfully',
                user: result.Attributes
            })
        };
    } catch (error) {
        console.error('Error removing VAPI credentials:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.getUserProfile = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        const params = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        
        const result = await dynamodb.get(params).promise();
        
        if (!result.Item) {
            // Create user profile if it doesn't exist
            const userEmail = event.requestContext.authorizer.claims.email;
            const newUser = {
                userId,
                email: userEmail,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString(),
                subscription: 'free'
            };
            
            await dynamodb.put({
                TableName: process.env.USERS_TABLE,
                Item: newUser
            }).promise();
            
            return {
                statusCode: 200,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify(newUser)
            };
        }
        
        // Update last login
        await dynamodb.update({
            TableName: process.env.USERS_TABLE,
            Key: { userId },
            UpdateExpression: 'SET lastLogin = :timestamp',
            ExpressionAttributeValues: {
                ':timestamp': new Date().toISOString()
            }
        }).promise();
        
        const user = result.Item;
        
        // Remove sensitive data
        delete user.vapiApiKey;
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(user)
        };
    } catch (error) {
        console.error('Error getting user profile:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.updateUserProfile = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const updates = JSON.parse(event.body);
        
        // Prevent updating sensitive fields
        delete updates.userId;
        delete updates.vapiApiKey;
        delete updates.createdAt;
        
        if (Object.keys(updates).length === 0) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'No valid updates provided' })
            };
        }
        
        // Build update expression
        const updateExpression = 'SET ' + Object.keys(updates)
            .map(key => `#${key} = :${key}`)
            .join(', ');
        
        const expressionAttributeNames = {};
        const expressionAttributeValues = {};
        
        Object.keys(updates).forEach(key => {
            expressionAttributeNames[`#${key}`] = key;
            expressionAttributeValues[`:${key}`] = updates[key];
        });
        
        const updateParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };
        
        const result = await dynamodb.update(updateParams).promise();
        
        // Remove sensitive data
        delete result.Attributes.vapiApiKey;
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(result.Attributes)
        };
    } catch (error) {
        console.error('Error updating user profile:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.getSyncStatus = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        const params = {
            TableName: process.env.VAPI_SYNC_TABLE || 'voice-matrix-vapi-sync',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };
        
        const result = await dynamodb.query(params).promise();
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(result.Items || [])
        };
    } catch (error) {
        console.error('Error getting sync status:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};