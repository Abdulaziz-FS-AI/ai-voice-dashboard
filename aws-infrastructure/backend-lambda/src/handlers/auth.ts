import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: {
    removeUndefinedValues: true
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'voice-matrix-secret-key';
const USERS_TABLE = process.env.USERS_TABLE!;

interface User {
  userId: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt?: string;
  isActive: boolean;
  tenantId?: string; // For SaaS multi-tenancy
  subscription?: {
    plan: 'free' | 'basic' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    expiresAt?: string;
  };
  profile?: {
    firstName?: string;
    lastName?: string;
    company?: string;
    phone?: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('Auth handler called:', JSON.stringify(event, null, 2));

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    const path = event.pathParameters?.proxy || '';
    const method = event.httpMethod;

    switch (`${method}:${path}`) {
      case 'POST:login':
        return await handleLogin(event);
      case 'POST:register':
        return await handleRegister(event);
      case 'POST:verify-token':
        return await handleVerifyToken(event);
      case 'POST:admin-login':
        return await handleAdminLogin(event);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Auth handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function handleLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const { email, password } = JSON.parse(event.body);

  if (!email || !password) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Email and password are required' })
    };
  }

  try {
    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    // Verify password
    console.log('Password verification for user:', user.email);
    console.log('Password provided:', password ? 'Yes' : 'No');
    console.log('Hash exists:', user.passwordHash ? 'Yes' : 'No');
    
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    console.log('Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid credentials' })
      };
    }

    if (!user.isActive) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Account is disabled' })
      };
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        token,
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          profile: user.profile
        }
      })
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Login failed' })
    };
  }
}

async function handleRegister(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const { email, password, firstName, lastName, company } = JSON.parse(event.body);

  if (!email || !password) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Email and password are required' })
    };
  }

  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User already exists' })
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user with SaaS features
    const userId = uuidv4();
    const tenantId = uuidv4(); // Each user gets their own tenant in SaaS model
    const user: User = {
      userId,
      email,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      tenantId,
      subscription: {
        plan: 'free',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days trial
      },
      profile: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(company && { company })
      }
    };

    await docClient.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)'
    }));

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.userId,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        token,
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          profile: user.profile
        }
      })
    };
  } catch (error) {
    console.error('Registration error:', error);
    console.error('Registration error stack:', error.stack);
    console.error('Registration error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Registration failed',
        details: error.message // Include error details for debugging
      })
    };
  }
}

async function handleVerifyToken(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Authorization header is required' })
    };
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Get fresh user data
    const user = await getUserById(decoded.userId);
    if (!user || !user.isActive) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        valid: true,
        user: {
          userId: user.userId,
          email: user.email,
          role: user.role,
          profile: user.profile
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }
}

async function handleAdminLogin(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const { pin } = JSON.parse(event.body);

  // Simple PIN check for demo/test mode
  if (pin === '123456') {
    const token = jwt.sign(
      {
        userId: 'admin-demo',
        email: 'admin@voicematrix.ai',
        role: 'admin'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        token,
        user: {
          userId: 'admin-demo',
          email: 'admin@voicematrix.ai',
          role: 'admin',
          profile: {
            firstName: 'Admin',
            lastName: 'User'
          }
        }
      })
    };
  }

  return {
    statusCode: 401,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Invalid PIN' })
  };
}

async function getUserByEmail(email: string): Promise<User | null> {
  try {
    console.log('Looking up user by email:', email);
    
    // Use scan with filter for email lookup (in production, use GSI)
    const result = await docClient.send(new ScanCommand({
      TableName: USERS_TABLE,
      FilterExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      },
      Limit: 1
    }));

    console.log('Scan result items:', result.Items?.length || 0);
    const user = result.Items && result.Items.length > 0 ? result.Items[0] as User : null;
    console.log('User found:', user ? 'Yes' : 'No');
    
    return user;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    return result.Item as User || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}