'use strict';

var events = require('events');
var easyrtc = require('easyrtc');

easyrtc.setOption('easyrtcidRegExp', /^.*[a-z0-9_.-]{1,32}$/i);

function EasyRTCAdapter() {
  var self = this;

  self.events = new events.EventEmitter();
  easyrtc.events.on('authenticate', function(socket, easyrtcid, appName, username, credential, easyrtcAuthMessage, next) {
    self.events.emit('authenticate', socket, easyrtcid, appName, username, credential, easyrtcAuthMessage, next);
  });
  easyrtc.events.on('disconnect', function(connectionObj, next) {
    self.events.emit('disconnection', connectionObj, next);
  });
  easyrtc.events.on('log', function(level, logText, logFields, next) {
    self.events.emit('log', level, logText, logFields, next);
  });
}

/**
*
* @param {hash} webserver
* @param {hash} wsserver
* @param {hash} options
* @param {hash} callback
*/
EasyRTCAdapter.prototype.listen = function listen(webserver, wsserver, options, callback) {
  var self = this;
  easyrtc.listen(webserver, wsserver, options, function(err, pub) {
    self.connect = pub.events.defaultListeners.connection;
    self.disconnect = pub.events.defaultListeners.disconnect;
    self.joinRoom = pub.events.defaultListeners.roomJoin;
    self.leaveRoom = pub.events.defaultListeners.roomLeave;
    self.createRoom = pub.events.defaultListeners.roomCreate;

    easyrtc.events.on('getIceConfig', function(connectionObj, callback) {
      self.events.emit('iceconfig', connectionObj, callback);
    });
    easyrtc.events.on('roomCreate', function(appObj, creatorConnectionObj, roomName, roomOptions, callback) {
      self.events.emit('room:create', appObj, creatorConnectionObj, roomName, roomOptions, callback);
    });
    easyrtc.events.on('connection', function(socket, easyrtcid, next) {
      self.events.emit('connection', socket, easyrtcid, next);
    });
    easyrtc.events.on('roomJoin', function(connectionObj, roomName, roomParameter, callback) {
      self.events.emit('room:join', connectionObj, roomName, roomParameter, callback);
    });
    easyrtc.events.on('roomLeave', function(connectionObj, roomName, next) {
      self.events.emit('room:leave', connectionObj, roomName, next);
    });

    callback(err);
  });
};

/**
*/
module.exports = EasyRTCAdapter;
