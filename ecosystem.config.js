module.exports = {
  apps: [
    {
      name: 'cryptobot',
      script: './node_modules/.bin/koishi',
      args: 'start',
      env: {
        NODE_ENV: 'prod',
      },
    },
  ],
};
