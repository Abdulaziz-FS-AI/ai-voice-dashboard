const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'eu-north-1_RvDRR8Kgr',
      userPoolClientId: process.env.REACT_APP_USER_POOL_WEB_CLIENT_ID || '74d2vmmqkhkaeqva03duv4h8r0'
    }
  }
};

export default awsconfig;