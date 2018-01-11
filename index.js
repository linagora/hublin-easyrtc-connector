const AwesomeModule = require('awesome-module');
const Dependency = AwesomeModule.AwesomeModuleDependency;
const MODULE_NAME = 'hublin.easyrtc.connector';

const easyRTCConnector = new AwesomeModule(MODULE_NAME, {
  dependencies: [
    new Dependency(Dependency.TYPE_ABILITY, 'wsserver', 'wsserver'),
    new Dependency(Dependency.TYPE_NAME, 'webserver.wrapper', 'webserver-wrapper'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.io.meetings.core.logger', 'logger'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.webrtc', 'webrtc')
  ],
  abilities: ['webrtc-adapter'],
  states: {
    lib: (dependencies, callback) => {
      const webrtc = dependencies('webrtc');
      const lib = require('./backend/lib')(dependencies);

      webrtc.registry.register(MODULE_NAME, lib);

      callback(null, { lib });
    },

    deploy: (dependencies, callback) => {
      const app = require('./backend/webserver/application')();
      const webserverWrapper = dependencies('webserver-wrapper');

      webserverWrapper.injectAngularModules('connector', [
        'app.js',
        'easyrtc-adapter.service.js',
        'easyrtc-factory.service.js',
        'listener-factory.service.js'
      ], MODULE_NAME, ['live-conference']);
      webserverWrapper.injectJSAsset('connector', ['easyrtc/easyrtc.js', 'easyrtc/labs/easyrtc_rates.js'], ['connector']);
      webserverWrapper.addApp('connector', app);

      callback();
    }
  }
});

module.exports = easyRTCConnector;
