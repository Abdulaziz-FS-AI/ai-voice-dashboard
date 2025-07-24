const awsconfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || 'eu-north-1_RvDRR8Kgr',
      // FINAL client ID - guaranteed to have no client secret
      userPoolClientId: '2rusigajolp05bnl2hmgb34ku9'
    }
  }
};

export default awsconfig;