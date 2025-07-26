# Voice Matrix AI Dashboard Setup Instructions

## 🚀 Quick Start Guide

This guide will help you get the Voice Matrix AI Dashboard running with working frontend buttons connected to the backend.

## Prerequisites

- Node.js 18+ installed
- AWS CLI configured (for backend deployment)
- Basic knowledge of React and AWS

## Backend Setup

### 1. Deploy the Serverless Backend

```bash
# Navigate to the backend directory
cd aws-infrastructure/backend-lambda

# Install dependencies
npm install

# Deploy to AWS (this creates API Gateway endpoints)
npm run deploy

# For production deployment
npm run deploy:prod
```

### 2. Get Your API Gateway URL

After deployment, you'll see output like:
```
endpoints:
  POST - https://abc123def4.execute-api.us-east-1.amazonaws.com/production/auth/{proxy+}
  POST - https://abc123def4.execute-api.us-east-1.amazonaws.com/production/user/{proxy+}
  # ... other endpoints
```

Copy the base URL (everything before `/auth` or `/user`): 
`https://abc123def4.execute-api.us-east-1.amazonaws.com/production`

## Frontend Setup

### 1. Configure Environment

```bash
# In the project root directory
cp .env.example .env.local
```

Edit `.env.local` and replace the API URL:
```env
REACT_APP_API_URL=https://your-actual-api-gateway-url.execute-api.us-east-1.amazonaws.com/production
```

### 2. Install Dependencies & Start

```bash
# Install frontend dependencies
npm install

# Start the development server
npm start
```

The application will open at `http://localhost:3000`

## 🎯 Testing the Buttons

### Test Login Button (PIN: 123456)
1. Click "🎯 Try Now (PIN: 123456)" or "Demo (PIN: 123456)"
2. Enter PIN: `123456`
3. You should be logged into the admin dashboard

### Get Started Button
1. Click "Get Started" or "Start 14-Day Free Trial"
2. You can either:
   - **Sign Up**: Create a new account with email/password
   - **Login**: Use existing credentials

## 🔧 Available Features

### Landing Page
- ✅ Professional marketing layout
- ✅ Working "Get Started" button → Auth flow
- ✅ Working "Demo Access" button → PIN login

### Authentication System
- ✅ User registration with email/password
- ✅ User login
- ✅ PIN-based demo access (PIN: 123456)
- ✅ JWT token management
- ✅ Automatic token verification

### Dashboard
- ✅ User profile display
- ✅ Mock analytics and statistics
- ✅ Setup progress tracking
- ✅ Recent activity feed
- ✅ Quick action buttons
- ✅ Responsive design

## 🐛 Troubleshooting

### "Network Error" on button clicks
- Check that your backend is deployed and running
- Verify the `REACT_APP_API_URL` in `.env.local`
- Check browser dev tools for CORS errors

### Backend deployment issues
```bash
# Check AWS credentials
aws sts get-caller-identity

# Redeploy with verbose logging
cd aws-infrastructure/backend-lambda
npm run deploy -- --verbose
```

### PIN login not working
- Ensure the backend `auth.ts` handler is deployed
- PIN should be exactly: `123456`
- Check browser network tab for API call details

## 📚 API Endpoints

The backend provides these working endpoints:

- `POST /auth/login` - User login
- `POST /auth/register` - User registration  
- `POST /auth/admin-login` - PIN-based demo access
- `POST /auth/verify-token` - Token validation
- `GET /dashboard/overview` - Dashboard data
- `GET /dashboard/stats` - Analytics stats

## 🎨 Customization

### Update Landing Page Content
Edit `src/components/LandingPage.tsx`

### Modify Dashboard Layout
Edit `src/components/Dashboard.tsx`

### Change Color Scheme
Update CSS custom properties in component CSS files

## 🔐 Security Notes

- Demo PIN (123456) is for testing only
- Change JWT secret in production
- Use proper environment variables for secrets
- Enable HTTPS in production

## 🚀 Production Deployment

### Frontend (Static Hosting)
```bash
npm run build
# Deploy the 'build' folder to your hosting service
```

### Backend (Already deployed via serverless)
The backend is automatically deployed to AWS Lambda + API Gateway when you run `npm run deploy`

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all environment variables
3. Ensure backend deployment completed successfully
4. Check AWS CloudWatch logs for backend issues

The system is now fully functional with working buttons connected to a robust backend!