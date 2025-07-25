const AWS = require('aws-sdk');
const axios = require('axios');
const crypto = require('crypto');

const dynamodb = new AWS.DynamoDB.DocumentClient();

// Use the VAPI API key from environment (admin key)
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

// Helper function to call VAPI API
async function callVapiApi(endpoint, method, data = null) {
    const config = {
        method,
        url: `${VAPI_BASE_URL}${endpoint}`,
        headers: {
            'Authorization': `Bearer ${VAPI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    };
    
    if (data) {
        config.data = data;
    }
    
    const response = await axios(config);
    return response.data;
}

// Create a new assistant for a user
exports.createAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { templateId, name, customConfig } = JSON.parse(event.body);
        
        let assistantConfig;
        
        // If templateId is provided, clone from template
        if (templateId) {
            // Get template from VAPI
            const template = await callVapiApi(`/assistant/${templateId}`, 'GET');
            
            // Create new assistant based on template
            assistantConfig = {
                ...template,
                name: name || `${template.name} - ${userId}`,
                metadata: {
                    ...template.metadata,
                    userId,
                    createdFrom: templateId,
                    createdAt: new Date().toISOString()
                }
            };
            
            // Remove the ID to create a new assistant
            delete assistantConfig.id;
        } else {
            // Create from scratch with custom config
            assistantConfig = {
                ...customConfig,
                name,
                metadata: {
                    ...customConfig.metadata,
                    userId,
                    createdAt: new Date().toISOString()
                }
            };
        }
        
        // Create assistant in VAPI
        const vapiAssistant = await callVapiApi('/assistant', 'POST', assistantConfig);
        
        // Store in DynamoDB for tracking
        const dbItem = {
            userId,
            assistantId: vapiAssistant.id,
            name: vapiAssistant.name,
            createdAt: new Date().toISOString(),
            templateId: templateId || null,
            status: 'active',
            phoneNumber: null // Not linked yet
        };
        
        await dynamodb.put({
            TableName: process.env.USER_ASSISTANTS_TABLE,
            Item: dbItem
        }).promise();
        
        // Store in assistants table if it's a template
        if (customConfig?.isTemplate) {
            await dynamodb.put({
                TableName: process.env.ASSISTANTS_TABLE,
                Item: {
                    assistantId: vapiAssistant.id,
                    templateName: vapiAssistant.name,
                    description: customConfig.description || '',
                    createdBy: userId,
                    createdAt: new Date().toISOString(),
                    isTemplate: true
                }
            }).promise();
        }
        
        return {
            statusCode: 201,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                ...vapiAssistant,
                phoneNumber: null
            })
        };
    } catch (error) {
        console.error('Error creating assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Get user's assistants
exports.getAssistants = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const { includeTemplates } = event.queryStringParameters || {};
        
        // Get user's assistants from DynamoDB
        const params = {
            TableName: process.env.USER_ASSISTANTS_TABLE,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };
        
        const userAssistants = await dynamodb.query(params).promise();
        
        // Get full details from VAPI for each assistant
        const assistantPromises = userAssistants.Items.map(async (item) => {
            try {
                const vapiAssistant = await callVapiApi(`/assistant/${item.assistantId}`, 'GET');
                return {
                    ...vapiAssistant,
                    phoneNumber: item.phoneNumber,
                    status: item.status
                };
            } catch (error) {
                console.error(`Failed to fetch assistant ${item.assistantId}:`, error);
                return null;
            }
        });
        
        let assistants = (await Promise.all(assistantPromises)).filter(Boolean);
        
        // Include templates if requested (for admin)
        if (includeTemplates === 'true') {
            const templatesResult = await dynamodb.scan({
                TableName: process.env.ASSISTANTS_TABLE,
                FilterExpression: 'isTemplate = :true',
                ExpressionAttributeValues: {
                    ':true': true
                }
            }).promise();
            
            const templatePromises = templatesResult.Items.map(async (item) => {
                try {
                    const vapiAssistant = await callVapiApi(`/assistant/${item.assistantId}`, 'GET');
                    return {
                        ...vapiAssistant,
                        isTemplate: true,
                        templateName: item.templateName
                    };
                } catch (error) {
                    console.error(`Failed to fetch template ${item.assistantId}:`, error);
                    return null;
                }
            });
            
            const templates = (await Promise.all(templatePromises)).filter(Boolean);
            assistants = [...assistants, ...templates];
        }
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(assistants)
        };
    } catch (error) {
        console.error('Error fetching assistants:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Update assistant
exports.updateAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantId = event.pathParameters.assistantId;
        const updateData = JSON.parse(event.body);
        
        // Verify user owns this assistant
        const ownership = await dynamodb.get({
            TableName: process.env.USER_ASSISTANTS_TABLE,
            Key: { userId, assistantId }
        }).promise();
        
        if (!ownership.Item) {
            return {
                statusCode: 403,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }
        
        // Update in VAPI
        const updatedAssistant = await callVapiApi(`/assistant/${assistantId}`, 'PATCH', updateData);
        
        // Update metadata in DynamoDB if needed
        if (updateData.name) {
            await dynamodb.update({
                TableName: process.env.USER_ASSISTANTS_TABLE,
                Key: { userId, assistantId },
                UpdateExpression: 'SET #name = :name, updatedAt = :updatedAt',
                ExpressionAttributeNames: {
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':name': updateData.name,
                    ':updatedAt': new Date().toISOString()
                }
            }).promise();
        }
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(updatedAssistant)
        };
    } catch (error) {
        console.error('Error updating assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Delete assistant
exports.deleteAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantId = event.pathParameters.assistantId;
        
        // Verify user owns this assistant
        const ownership = await dynamodb.get({
            TableName: process.env.USER_ASSISTANTS_TABLE,
            Key: { userId, assistantId }
        }).promise();
        
        if (!ownership.Item) {
            return {
                statusCode: 403,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }
        
        // Check if phone number is linked
        if (ownership.Item.phoneNumber) {
            return {
                statusCode: 400,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Cannot delete assistant with linked phone number. Unlink phone first.' })
            };
        }
        
        // Delete from VAPI
        await callVapiApi(`/assistant/${assistantId}`, 'DELETE');
        
        // Delete from DynamoDB
        await dynamodb.delete({
            TableName: process.env.USER_ASSISTANTS_TABLE,
            Key: { userId, assistantId }
        }).promise();
        
        return {
            statusCode: 204,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: ''
        };
    } catch (error) {
        console.error('Error deleting assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Link phone number to assistant
exports.linkPhoneToAssistant = async (event) => {
    try {
        const userId = event.requestContext.authorizer.claims.sub;
        const assistantId = event.pathParameters.assistantId;
        const { phoneNumber, phoneNumberId } = JSON.parse(event.body);
        
        // Verify user owns this assistant
        const ownership = await dynamodb.get({
            TableName: process.env.USER_ASSISTANTS_TABLE,
            Key: { userId, assistantId }
        }).promise();
        
        if (!ownership.Item) {
            return {
                statusCode: 403,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Unauthorized' })
            };
        }
        
        // Verify user owns this phone number
        const phoneOwnership = await dynamodb.get({
            TableName: process.env.PHONE_NUMBERS_TABLE,
            Key: { phoneNumberId }
        }).promise();
        
        if (!phoneOwnership.Item || phoneOwnership.Item.userId !== userId) {
            return {
                statusCode: 403,
                headers: { 'Access-Control-Allow-Origin': '*' },
                body: JSON.stringify({ error: 'Unauthorized phone number' })
            };
        }
        
        // Update phone number in VAPI to use this assistant
        await callVapiApi(`/phone-number/${phoneNumberId}`, 'PATCH', {
            assistantId
        });
        
        // Update DynamoDB records
        await Promise.all([
            // Update user assistant record
            dynamodb.update({
                TableName: process.env.USER_ASSISTANTS_TABLE,
                Key: { userId, assistantId },
                UpdateExpression: 'SET phoneNumber = :phoneNumber, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':phoneNumber': phoneNumber,
                    ':updatedAt': new Date().toISOString()
                }
            }).promise(),
            
            // Update phone number record
            dynamodb.update({
                TableName: process.env.PHONE_NUMBERS_TABLE,
                Key: { phoneNumberId },
                UpdateExpression: 'SET assistantId = :assistantId, updatedAt = :updatedAt',
                ExpressionAttributeValues: {
                    ':assistantId': assistantId,
                    ':updatedAt': new Date().toISOString()
                }
            }).promise()
        ]);
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
                message: 'Phone number linked successfully',
                assistantId,
                phoneNumber
            })
        };
    } catch (error) {
        console.error('Error linking phone to assistant:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Get available templates (for users to clone)
exports.getTemplates = async (event) => {
    try {
        // Get all templates
        const templatesResult = await dynamodb.scan({
            TableName: process.env.ASSISTANTS_TABLE,
            FilterExpression: 'isTemplate = :true',
            ExpressionAttributeValues: {
                ':true': true
            }
        }).promise();
        
        // Get full details from VAPI
        const templatePromises = templatesResult.Items.map(async (item) => {
            try {
                const vapiAssistant = await callVapiApi(`/assistant/${item.assistantId}`, 'GET');
                return {
                    ...vapiAssistant,
                    isTemplate: true,
                    templateName: item.templateName,
                    description: item.description
                };
            } catch (error) {
                console.error(`Failed to fetch template ${item.assistantId}:`, error);
                return null;
            }
        });
        
        const templates = (await Promise.all(templatePromises)).filter(Boolean);
        
        return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify(templates)
        };
    } catch (error) {
        console.error('Error fetching templates:', error);
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: error.message })
        };
    }
};