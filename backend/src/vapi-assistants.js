const AWS = require('aws-sdk');
const axios = require('axios');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.getAssistants = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        
        // Get user's VAPI credentials from DynamoDB
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Call VAPI API to get assistants
        const vapiResponse = await axios.get('https://api.vapi.ai/assistant', {
            headers: {
                'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(vapiResponse.data)
        };
    } catch (error) {
        console.error('Error fetching VAPI assistants:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.createAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantConfig = JSON.parse(event.body);
        
        // Get user's VAPI credentials
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Create assistant via VAPI API
        const vapiResponse = await axios.post(
            'https://api.vapi.ai/assistant',
            assistantConfig,
            {
                headers: {
                    'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            statusCode: 201,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(vapiResponse.data)
        };
    } catch (error) {
        console.error('Error creating VAPI assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.updateAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantId = event.pathParameters.assistantId;
        const assistantConfig = JSON.parse(event.body);
        
        // Get user's VAPI credentials
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Update assistant via VAPI API
        const vapiResponse = await axios.patch(
            `https://api.vapi.ai/assistant/${assistantId}`,
            assistantConfig,
            {
                headers: {
                    'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(vapiResponse.data)
        };
    } catch (error) {
        console.error('Error updating VAPI assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.deleteAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantId = event.pathParameters.assistantId;
        
        // Get user's VAPI credentials
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Delete assistant via VAPI API
        await axios.delete(`https://api.vapi.ai/assistant/${assistantId}`, {
            headers: {
                'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        return {
            statusCode: 204,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: ''
        };
    } catch (error) {
        console.error('Error deleting VAPI assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

exports.getVapiCalls = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { limit = 50, cursor } = event.queryStringParameters || {};
        
        // Get user's VAPI credentials
        const userParams = {
            TableName: process.env.USERS_TABLE,
            Key: { userId }
        };
        const userData = await dynamodb.get(userParams).promise();
        
        if (!userData.Item?.vapiApiKey) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'VAPI API key not configured' })
            };
        }
        
        // Get calls from VAPI API
        const params = { limit };
        if (cursor) params.cursor = cursor;
        
        const vapiResponse = await axios.get('https://api.vapi.ai/call', {
            headers: {
                'Authorization': `Bearer ${userData.Item.vapiApiKey}`,
                'Content-Type': 'application/json'
            },
            params
        });
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(vapiResponse.data)
        };
    } catch (error) {
        console.error('Error fetching VAPI calls:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};