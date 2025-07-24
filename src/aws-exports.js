const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'eu-north-1_RvDRR8Kgr',
      userPoolClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID || '7645g8ltvu8mqc3sobft1ns2pa'
    }
  }
};

export default awsconfig;