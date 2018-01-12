(function(angular) {
  'use strict';

  angular.module('hublin.easyrtc.connector')
    .factory('easyRTCListenerFactory', easyRTCListenerFactory);

  function easyRTCListenerFactory($log) {
    return function(addListenerFunction, callbackName) {
      var callbacks = [];

      return {
        addListener: addListener,
        removeListener: removeListener
      };

      function addListener(pushedCallback) {
        callbacks.push(pushedCallback);

        addListenerFunction(function() {
          var listenerArguments = arguments;

          if (callbackName) {
            $log.debug('Added callback for ' + callbackName);
          }
          callbacks.forEach(function(callback) {
            callback.apply(this, listenerArguments);
          });
        });

        return pushedCallback;
      }

      function removeListener(removeCallback) {
        if (callbackName) {
          $log.debug('Deleted callback for ' + callbackName);
        }
        var index = callbacks.indexOf(removeCallback);

        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }
})(angular);
