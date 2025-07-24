const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'eu-north-1_RvDRR8Kgr',
      // FORCE the new client ID - ignore any environment variable override
      userPoolClientId: '74d2vmmqkhkaeqva03duv4h8r0'
    }
  }
};

export default awsconfig;