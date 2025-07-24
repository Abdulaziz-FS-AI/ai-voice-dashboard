const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'eu-north-1_RvDRR8Kgr',
      userPoolClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID || '7645g8ltvu8mqc3sobft1ns2pa',
      loginWith: {
        oauth: {
          domain: process.env.REACT_APP_OAUTH_DOMAIN || 'voice-matrix-auth.auth.eu-north-1.amazoncognito.com',
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: process.env.REACT_APP_REDIRECT_URL || 'http://localhost:3000/',
          redirectSignOut: process.env.REACT_APP_REDIRECT_URL || 'http://localhost:3000/',
          responseType: 'code',
          providers: ['Google']
        }
      },
      passwordFormat: {
        minLength: 7,
        requireLowercase: true,
        requireUppercase: false,
        requireNumbers: true,
        requireSpecialCharacters: false
      }
    }
  }
};

export default awsconfig;