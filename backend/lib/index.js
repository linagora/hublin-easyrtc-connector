'use strict';

module.exports = function(dependencies) {
  var api = {
    adapter: require('./EasyRTCAdapter'),
    auth: require('./auth/token')(dependencies)
  };

  return api;
};
