(function(angular) {
  'use strict';

  angular.module('hublin.easyrtc.connector')
    .run(runBlock);

  function runBlock(easyRTCAdapter, webRTCAdapterRegistry, EASYRTC_MODULE_NAME) {
    webRTCAdapterRegistry.register(EASYRTC_MODULE_NAME, easyRTCAdapter);
  }
})(angular);
