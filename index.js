'use strict';

var AwesomeModule = require('awesome-module');
var Dependency = AwesomeModule.AwesomeModuleDependency;
var path = require('path');

var myAwesomeModule = new AwesomeModule('hublin.easyrtc.connector', {
  dependencies: [
    new Dependency(Dependency.TYPE_NAME, 'linagora.io.meetings.core.logger', 'logger'),
  ],
  abilities: ['hublin.webrtc.connector'],
  states: {
    lib: function(dependencies, callback) {
      var lib = {
        lib: require('./backend/lib')(dependencies)
      };

      return callback(null, lib);
    },

    deploy: function(dependencies, callback) {
      return callback();
    }
  }
});

/**
 * The main AwesomeModule describing the application.
 * @type {AwesomeModule}
 */
module.exports = myAwesomeModule;
