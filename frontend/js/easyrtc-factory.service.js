(function(angular) {
  'use strict';

  angular.module('hublin.easyrtc.connector')
    .factory('easyRTCFactory', easyRTCFactory);

  function easyRTCFactory($window) {
    return {
      get: get
    };

    function get() {
      return $window.easyrtc;
    }
  }
})(angular);
