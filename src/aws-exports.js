const awsconfig = {
  Auth: {
    region: 'eu-north-1',
    userPoolId: 'eu-north-1_RvDRR8Kgr',
    userPoolWebClientId: '7645g8ltvu8mqc3sobft1ns2pa',
    oauth: {
      domain: 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_RvDRR8Kgr',
      scope: ['phone', 'openid', 'email', 'profile'],
      redirectSignIn: 'https://d84l1y8p4kdic.cloudfront.net/',
      redirectSignOut: 'https://d84l1y8p4kdic.cloudfront.net/',
      responseType: 'code'
    }
  }
};

export default awsconfig;