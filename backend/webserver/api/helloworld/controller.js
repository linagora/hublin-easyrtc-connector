'use strict';

var logger, core;

function sayHello(req, res) {
  logger.info('My module controller says hello world!');
  return res.json(200, {message: core.getMessage()});
}

module.exports = function(dependencies) {
  logger = dependencies('logger');
  core = require('./core')(dependencies);
  return {
    sayHello: sayHello
  };
};
