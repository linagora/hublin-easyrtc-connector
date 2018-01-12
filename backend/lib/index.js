module.exports = dependencies => ({
  WebRTCAdapter: require('./EasyRTCAdapter'),
  onAuthenticate: require('./auth/token')(dependencies)
});
