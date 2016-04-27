'use strict';

var AwesomeModule = require('awesome-module');
var Dependency = AwesomeModule.AwesomeModuleDependency;
var path = require('path');

var myAwesomeModule = new AwesomeModule('esn.helloworld', {
  dependencies: [
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.logger', 'logger'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.webserver.wrapper', 'webserver-wrapper')
  ],

  states: {
    lib: function(dependencies, callback) {
      var helloworldlib = require('./backend/lib')(dependencies);
      var helloworld = require('./backend/webserver/api/helloworld')(dependencies);

      var lib = {
        api: {
          helloworld: helloworld
        },
        lib: helloworldlib
      };

      return callback(null, lib);
    },

    deploy: function(dependencies, callback) {
      // Register the webapp
      var app = require('./backend/webserver')(dependencies, this);
      // Register every exposed endpoints
      app.use('/', this.api.helloworld);

      var webserverWrapper = dependencies('webserver-wrapper');
      // Register every exposed frontend scripts
      var jsFiles = [
        'app.js',
        'helloworld/services.js',
        'helloworld/directives.js',
        'helloworld/controllers.js'
      ];
      webserverWrapper.injectAngularModules('helloworld', jsFiles, ['esn.helloworld'], ['esn']);
      var lessFile = path.resolve(__dirname, './frontend/css/styles.less');
      webserverWrapper.injectLess('helloworld', [lessFile], 'esn');
      webserverWrapper.addApp('helloworld', app);

      return callback();
    }
  }
});

/**
 * The main AwesomeModule describing the application.
 * @type {AwesomeModule}
 */
module.exports = myAwesomeModule;
