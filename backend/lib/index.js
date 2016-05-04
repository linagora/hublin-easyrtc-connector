'use strict';

module.exports = function(dependencies) {
  var api = {
    adapter: require('./EasyRTCAdapter')
  };

  return api;
};
