'use strict';

/**
 * Auth Middleware
 *
 * @param {hash} dependencies
 * @return {Function}
 */
module.exports = function(dependencies) {
  var socketioHelper = dependencies('wsserver').helper;

  return function(socket, easyrtcid, appName, username, credential, easyrtcAuthMessage, next) {
    var userId = socketioHelper.getUserId(socket);
    if (!userId) {
      next(new Error('Websocket not authenticated'));
    } else {
      next(null);
    }
  };
};
