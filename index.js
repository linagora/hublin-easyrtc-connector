const AwesomeModule = require('awesome-module');
const Dependency = AwesomeModule.AwesomeModuleDependency;

const easyRTCConnector = new AwesomeModule('hublin.easyrtc.connector', {
  dependencies: [
    new Dependency(Dependency.TYPE_ABILITY, 'wsserver', 'wsserver'),
    new Dependency(Dependency.TYPE_NAME, 'webserver.wrapper', 'webserver-wrapper'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.io.meetings.core.logger', 'logger')
  ],
  abilities: ['hublin.webrtc.connector'],
  states: {
    lib: (dependencies, callback) => {
      callback(null, {
        lib: require('./backend/lib')(dependencies)
      });
    },

    deploy: (dependencies, callback) => {
      const app = require('./backend/webserver/application')();
      const webserverWrapper = dependencies('webserver-wrapper');

      webserverWrapper.injectAngularModules('connector', ['app.js', 'services/easyRTCAdapter.js'], 'hublin.easyrtc.connector', ['live-conference']);
      webserverWrapper.injectJSAsset('connector', ['easyrtc/easyrtc.js', 'easyrtc/labs/easyrtc_rates.js'], ['connector']);
      webserverWrapper.addApp('connector', app);

      callback();
    }
  }
});

module.exports = easyRTCConnector;
