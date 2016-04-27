'use strict';

var express = require('express');

module.exports = function(dependencies) {

  var controller = require('./controller')(dependencies);
  var middleware = require('./middleware')(dependencies);

  var router = express.Router();

  router.get('/api/sayhello', middleware.passThrough, controller.sayHello);

  return router;
};
