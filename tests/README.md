# Voice Matrix AI Dashboard - Test Suite

Comprehensive testing suite for the Voice Matrix AI Dashboard application, covering backend APIs, VAPI integration, admin functionality, and complete user journeys.

## 🧪 Test Structure

### 1. Backend API Tests (`backend-api-tests.js`)
Tests all backend Lambda function endpoints:
- Authentication (login, register, admin login)
- Token verification and management
- VAPI proxy endpoints
- Dashboard data APIs
- Admin user management
- CORS and security headers

### 2. VAPI Integration Tests (`vapi-integration-tests.js`)
Tests VAPI connectivity and functionality:
- Direct VAPI API validation
- Backend VAPI proxy functionality
- Assistant management
- Phone number management
- Account information retrieval
- Error handling and rate limiting

### 3. Admin Dashboard Tests (`admin-dashboard-tests.js`)
Tests admin functionality and security:
- Admin PIN authentication
- User management capabilities
- Admin-only endpoint access
- Security measures (SQL injection, XSS prevention)  
- System health monitoring
- Audit capabilities

### 4. End-to-End User Journey Tests (`e2e-user-journey-tests.js`)
Tests complete user workflows:
- New user registration → Login → Dashboard access
- VAPI setup and assistant creation
- Session persistence and data consistency
- Admin workflow integration
- Multi-step user interactions

## 🚀 Running Tests

### Run All Tests
```bash
node tests/run-all-tests.js
```

### Run Individual Test Suites
```bash
# Backend API tests
node tests/backend-api-tests.js

# VAPI integration tests  
node tests/vapi-integration-tests.js

# Admin dashboard tests
node tests/admin-dashboard-tests.js

# End-to-end user journey tests
node tests/e2e-user-journey-tests.js
```

### Quick Tests for Specific Components
```bash
# Quick backend test
node tests/run-all-tests.js --quick backend

# Quick VAPI test
node tests/run-all-tests.js --quick vapi

# Quick admin test
node tests/run-all-tests.js --quick admin

# Quick E2E test
node tests/run-all-tests.js --quick e2e
```

### Health Check
```bash
node tests/run-all-tests.js --health
```

### Generate Test Report
```bash
node tests/run-all-tests.js --save-report
```

## 🎯 Test Categories

### ✅ **Authentication Tests**
- User registration and login
- Admin PIN authentication (PIN: 123456)
- JWT token validation and expiration
- Invalid credential handling

### 🎙️ **VAPI Integration Tests**  
- VAPI API key validation (661b91f4-60e3-457e-820a-1dc7987b2b1c)
- Assistant creation and management
- Phone number provisioning
- Real-time call handling
- Environment variable configuration

### 👨‍💼 **Admin Functionality Tests**
- User management and oversight
- System statistics and monitoring
- Admin-only endpoint security
- Emergency access capabilities

### 🔄 **User Journey Tests**
- Complete registration → dashboard flow  
- VAPI setup and configuration
- Assistant creation workflow
- Session management and persistence

## 📊 Test Configuration

### Environment Variables
The tests use the following configuration:
- **Backend URL**: `https://jtpyvtfavj.execute-api.us-east-1.amazonaws.com/production`
- **Frontend URL**: `https://main.d3nqtyqk3krtlj.amplifyapp.com`
- **Admin PIN**: `123456`
- **VAPI API Key**: `661b91f4-60e3-457e-820a-1dc7987b2b1c`

### Test Data
- Tests create temporary users with timestamp-based emails
- All test data is prefixed with identifiers for easy cleanup
- No production data is affected by test runs

## 🛡️ Security Tests

### Authentication Security
- SQL injection prevention
- XSS attack prevention  
- Invalid token handling
- Admin access control

### API Security
- CORS header validation
- Request rate limiting
- Token expiration handling
- Unauthorized access prevention

## 📈 Expected Results

### ✅ **Passing Tests Indicate:**
- Backend APIs are functional
- VAPI integration is working
- Authentication system is secure
- User workflows complete successfully
- Admin functions are operational

### ❌ **Failing Tests May Indicate:**
- Backend deployment issues
- VAPI API key problems
- Database connectivity issues
- Authentication token problems
- Network connectivity issues

## 🔧 Troubleshooting

### Common Issues:

**Network Errors**
- Check internet connectivity
- Verify backend URL is accessible
- Ensure VAPI API key is valid

**Authentication Failures**
- Verify admin PIN (123456)
- Check JWT token generation
- Ensure DynamoDB tables exist

**VAPI Integration Issues**
- Validate VAPI API key
- Check environment variable configuration
- Verify AWS Lambda permissions

## 📋 Test Checklist

Before deployment, ensure all these test categories pass:

- [ ] Backend API endpoints respond correctly
- [ ] User authentication works (register/login)
- [ ] Admin authentication works (PIN: 123456)
- [ ] VAPI integration functions properly
- [ ] Dashboard loads user data
- [ ] Admin dashboard shows system stats
- [ ] Complete user journey works end-to-end
- [ ] Security measures are effective

## 🎉 Success Criteria

**Production Ready** when:
- ✅ All test suites pass (100% success rate)
- ✅ Health check shows all services healthy
- ✅ Complete user journey completes without errors
- ✅ Admin functionality works correctly
- ✅ VAPI integration is fully functional

## 📞 Support

If tests fail:
1. Check the specific error messages in test output
2. Verify all environment variables are set correctly
3. Ensure backend deployment was successful
4. Validate VAPI API key is active
5. Check AWS Lambda function logs for detailed errors

---

**Voice Matrix AI Dashboard Test Suite**  
Complete testing coverage for production deployment validation.