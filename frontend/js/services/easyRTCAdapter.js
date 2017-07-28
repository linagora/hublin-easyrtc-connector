'use strict';

angular.module('hublin.easyrtc.connector')
  .factory('listenerFactory', ['$log', function($log) {
    return function(addListenerFunction, callbackName) {
      var callbacks = [];
      return {
        addListener: function(pushedCallback) {
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
        },
        removeListener: function(removeCallback) {
          if (callbackName) {
            $log.debug('Deleted callback for ' + callbackName);
          }
          var index = callbacks.indexOf(removeCallback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    };
  }])

  .factory('webrtcFactory', function() {
    function get($window) {
      return window.easyrtc;
    }

    return {
      get: get
    };
  })

  .factory('easyRTCAdapter', ['$rootScope', '$log', 'webrtcFactory', 'tokenAPI', 'session',
    'ioSocketConnection', 'ioConnectionManager', '$timeout', 'EASYRTCBITRATES', 'currentConferenceState',
    'LOCAL_VIDEO_ID', 'REMOTE_VIDEO_IDS', 'EASYRTC_APPLICATION_NAME', 'EASYRTC_EVENTS', '$q', 'listenerFactory', 'MAX_P2P_MESSAGE_LENGTH',
    function($rootScope, $log, webrtcFactory, tokenAPI, session, ioSocketConnection, ioConnectionManager, $timeout, EASYRTCBITRATES, currentConferenceState,
             LOCAL_VIDEO_ID, REMOTE_VIDEO_IDS, EASYRTC_APPLICATION_NAME, EASYRTC_EVENTS, $q, listenerFactory, MAX_P2P_MESSAGE_LENGTH) {
      var easyrtc = webrtcFactory.get();
      easyrtc.enableDataChannels(true);

      var bitRates, room, disconnectCallbacks = [];
      var videoEnabled = true;

      var checkFirefoxEnumerateDevices = navigator.mozGetUserMedia && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices;
      var isChromeBrowser = window.webrtcDetectedBrowser === 'chrome';
      var canEnumerateDevices = checkFirefoxEnumerateDevices || isChromeBrowser;

      easyrtc.setMaxP2PMessageLength(MAX_P2P_MESSAGE_LENGTH);
      easyrtc.getVideoSourceList(function(results) {
        if (isChromeBrowser) {
          if (results.length === 0) {
            videoEnabled = false;
            easyrtc.enableVideo(false);
          }
        }

        if (checkFirefoxEnumerateDevices) { // only for firefox >= 39
          navigator.mediaDevices.enumerateDevices().then(function(devices) {
            videoEnabled = devices.some(function(device) {
              return device.kind === 'videoinput';
            });
            easyrtc.enableVideo(videoEnabled);
          });
        }
      });

      function removeDisconnectCallback(id) {
        if (!id) {
          return false;
        }

        disconnectCallbacks.splice(id, 1);
      }

      function addDisconnectCallback(callback) {
        if (!callback) {
          return false;
        }

        return disconnectCallbacks.push(callback) - 1;
      }

      easyrtc.setDisconnectListener(function() {
        disconnectCallbacks.forEach(function(callback) {
          callback();
        });
      });

      addDisconnectCallback(function() {
        $log.info('Lost connection to signaling server');
      });

      function stopLocalStream() {
        var stream = easyrtc.getLocalStream();
        if (stream) {
          stream.getTracks().forEach(function(track) { track.stop(); });
        }
      }

      function leaveRoom(conference) {
        stopLocalStream();
        easyrtc.leaveRoom(conference._id, function() {
          $log.debug('Left the conference ' + conference._id);
          $rootScope.$emit('conference:left', {conference_id: conference._id});
        }, function() {
          $log.error('Error while leaving conference');
        });
      }

      function performCall(otherEasyrtcid) {
        $log.debug('Calling ' + otherEasyrtcid);
        easyrtc.hangupAll();

        function onSuccess() {
          $log.debug('Successfully connected to ' + otherEasyrtcid);
        }

        function onFailure() {
          $log.error('Error while connecting to ' + otherEasyrtcid);
        }

        easyrtc.call(otherEasyrtcid, onSuccess, onFailure);
      }

      // This function will be called when the connection has occured
      var ret = (function() {
          var callback,
            connected = false, failed = false;

          function onConnectionCallbackHelper(newCallback) {
            if (connected && failed === false) {
              newCallback();
            } else if (!connected && failed === false) {
              callback = newCallback;
            } else {
              newCallback(failed);
            }
          }
          function callOnConnectedSuccess() {
            connected = true;
            if (callback !== undefined) {
              callback();
            }
          }
          function callOnConnectedError(errorCode, message) {
            failed = {errorCode: errorCode, message: message};
            if (callback !== undefined) {
              callback(failed);
            }
          }
          return {
            onConnectionCallback: listenerFactory(onConnectionCallbackHelper).addListener,
            callOnConnectedSuccess: callOnConnectedSuccess,
            callOnConnectedError: callOnConnectedError
          };
        })(),
        onConnectionCallback = ret.onConnectionCallback,
        callOnConnectedSuccess = ret.callOnConnectedSuccess,
        callOnConnectedError = ret.callOnConnectedError;

      function connect(conferenceState, callback) {

        function entryListener(entry, roomName) {
          if (entry) {
            $log.debug('Entering room ' + roomName);
            room = roomName;
          } else {
            $log.debug('Leaving room ' + roomName);
            room = null;
          }
        }

        function roomOccupantListener(roomName, data, isPrimary) {
          easyrtc.setRoomOccupantListener(null); // so we're only called once.
          $log.debug('New user(s) in room ' + roomName);
          $log.debug('Room data ', data);

          function onSuccess() {
            $log.info('Successfully connected to user');
          }

          function onFailure() {
            $log.error('Error while connecting to user');
          }

          for (var easyrtcid in data) {
            $log.debug('Calling: ' + easyrtc.idToName(easyrtcid));
            easyrtc.call(easyrtcid, onSuccess, onFailure);
          }
        }

        if (bitRates) {
          var localFilter = easyrtc.buildLocalSdpFilter({audioRecvBitrate: bitRates.audio, videoRecvBitrate: bitRates.video});
          var remoteFilter = easyrtc.buildRemoteSdpFilter({audioSendBitrate: bitRates.audio, videoSendBitrate: bitRates.video});
          easyrtc.setSdpFilters(localFilter, remoteFilter);
        }

        easyrtc.setRoomOccupantListener(roomOccupantListener);
        easyrtc.setRoomEntryListener(entryListener);

        var conference = conferenceState.conference;
        if (!(conference._id in easyrtc.roomJoin)) {
          easyrtc.joinRoom(conference._id, null,
            function() {
              $log.debug('Joined room ' + conference._id);
            },
            function() {
              $log.debug('Error while joining room ' + conference._id);
            }
          );
        }

        easyrtc.username = session.getUserId();

        function onWebsocket() {
          var sio = ioSocketConnection.getSio();
          sio.socket = {connected: true};
          easyrtc.useThisSocketConnection(sio);

          function onLoginSuccess(easyrtcid) {
            $log.debug('Successfully logged: ' + easyrtcid);
            conferenceState.pushAttendee(0, easyrtcid, session.getUserId(), session.getUsername());
            conferenceState.updateTimezoneOffsetFromIndex(0, new Date().getTimezoneOffset());
            $rootScope.$apply();
            if (!videoEnabled) {
              conferenceState.updateMuteVideoFromIndex(0, true);
            }
            if (callback) {
              callback(null);
            }
            callOnConnectedSuccess();
          }

          function onLoginFailure(errorCode, message) {
            $log.error('Error while connecting to the webrtc signaling service ' + errorCode + ' : ' + message);
            if (callback) {
              callback(errorCode);
            }
            callOnConnectedError(errorCode, message);
          }

          easyrtc.setOnError(function(errorObject) {
            $log.error('setOnError with error: ' + errorObject.errorText + ' [error=' + JSON.stringify(errorObject) + ']');
          });

          easyrtc.setVideoDims();

          easyrtc.easyApp(
            EASYRTC_APPLICATION_NAME,
            LOCAL_VIDEO_ID,
            REMOTE_VIDEO_IDS,
            onLoginSuccess,
            onLoginFailure);

          easyrtc.setOnCall(function(easyrtcid, slot) {
            $log.debug('SetOnCall', easyrtcid);
            conferenceState.pushAttendee(slot + 1, easyrtcid);
            $rootScope.$apply();
          });

          addDataChannelOpenListener(function(easyrtcid) {
            var data = prepareAttendeeForBroadcast(conferenceState.attendees[0]);
            $log.debug('Data channel open, sending %s event with data: ', EASYRTC_EVENTS.attendeeUpdate, data);
            easyrtc.sendData(easyrtcid, EASYRTC_EVENTS.attendeeUpdate, data);
          });

          easyrtc.setOnHangup(function(easyrtcid, slot) {
            $log.debug('setOnHangup', easyrtcid);
            conferenceState.removeAttendee(slot + 1);
            $rootScope.$apply();
          });

          addPeerListener(function(easyrtcid, msgType, msgData) {
            $log.debug('Event %s received from %s with data: ', EASYRTC_EVENTS.attendeeUpdate, easyrtcid, msgData);
            conferenceState.updateAttendeeByRtcid(easyrtcid, msgData);
          }, EASYRTC_EVENTS.attendeeUpdate);
        }

        if (ioSocketConnection.isConnected()) {
          onWebsocket();
        } else {
          ioSocketConnection.addConnectCallback(onWebsocket);
        }

      }

      function enableMicrophone(muted) {
        easyrtc.enableMicrophone(muted);
      }

      function enableCamera(videoMuted) {
        easyrtc.enableCamera(videoMuted);
      }

      function enableVideo(videoChoice) {
        videoEnabled = videoChoice;
        easyrtc.enableVideo(videoChoice);
      }

      function isVideoEnabled() {
        return videoEnabled;
      }

      function muteRemoteMicrophone(easyrtcid, mute) {
        var stream = easyrtc.getRemoteStream(easyrtcid);
        if (stream && stream.getAudioTracks) {
          var tracks = stream.getAudioTracks();
          if (tracks) {
            tracks.forEach(function(track) {
              track.enabled = !mute;
            });
          }
        }
      }

      function sendDataP2P(easyrtcid, msgType, data) {
        easyrtc.sendDataP2P(easyrtcid, msgType, data);
      }

      function sendDataWS(easyrtcid, msgType, data, ackhandler) {
        easyrtc.sendDataWS(easyrtcid, msgType, data, ackhandler);
      }

      function sendData(easyrtcid, msgType, data, ackhandler) {
        easyrtc.sendData(easyrtcid, msgType, data, ackhandler);
      }

      function getP2PConnectionStatus(easyrtcid) {
        return easyrtc.getConnectStatus(easyrtcid);
      }

      function doesDataChannelWork(easyrtcid) {
        return easyrtc.doesDataChannelWork(easyrtcid);
      }

      function setPeerListener(handler, msgType) {
        $log.warn('If you use setPeerListener, only the last handler will be executed!');
        easyrtc.setPeerListener(handler, msgType);
      }

      function configureBandwidth(rate) {
        if (rate) {
          bitRates = EASYRTCBITRATES[rate];
        } else {
          bitRates = null;
        }
      }

      function myEasyrtcid() {
        return easyrtc.myEasyrtcid;
      }

      function prepareAttendeeForBroadcast(attendee) {
        return {
          id: attendee.id,
          easyrtcid: attendee.rtcid,
          displayName: attendee.displayName,
          avatar: attendee.avatar,
          mute: attendee.mute,
          muteVideo: attendee.muteVideo,
          speaking: attendee.speaking,
          timezoneOffset: attendee.timezoneOffset
        };
      }

      function broadcastData(msgType, data) {
        var occupants = easyrtc.getRoomOccupantsAsArray(room);

        if (!occupants) {
          return;
        }

        occupants.forEach(function(easyrtcid) {
          if (easyrtcid === myEasyrtcid()) {
            return;
          }

          easyrtc.sendData(easyrtcid, msgType, data);
        });
      }

      function broadcastMe() {
        var attendee = currentConferenceState.getAttendeeByRtcid(myEasyrtcid());

        if (!attendee) {
          return;
        }

        broadcastData(EASYRTC_EVENTS.attendeeUpdate, prepareAttendeeForBroadcast(attendee));
      }

      easyrtc.setDataChannelCloseListener(function(easyrtcid) {
        $log.debug('MEET-255 Data channel closed with ' + easyrtcid);
      });

      easyrtc.setCallCancelled(function(easyrtcid, explicitlyCancelled) {
        if (explicitlyCancelled) {
          $log.debug('MEET-255 ' + easyrtc.idToName(easyrtcid) + ' stopped trying to reach you');
        } else {
          $log.debug('MEET-255 Implicitly called ' + easyrtc.idToName(easyrtcid));
        }
      });

      easyrtc.setOnStreamClosed(function(easyrtcid, stream, streamName) {
        $log.debug('MEET-255 ' + easyrtc.idToName(easyrtcid) + ' closed stream ' + stream.id + ' ' + streamName);
      });

      function setGotMedia(cb) {
        if (easyrtc.setGotMedia) {
          easyrtc.setGotMedia(cb);
        } else {
          cb(easyrtc.setGotMedia, 'media stream not found');
        }
      }

      function connection() {
        var defer = $q.defer();
        onConnectionCallback(function(errorCode, message) {
          if (!errorCode) {
            defer.resolve();
          } else {
            defer.reject(errorCode);
          }
        });
        return defer.promise;
      }

      function getOpenedDataChannels() {
        return (easyrtc.getRoomOccupantsAsArray(room) || []).filter(function(peer) {
          return easyrtc.doesDataChannelWork(peer);
        });
      }

      var tmp;
      tmp = listenerFactory(easyrtc.setDataChannelOpenListener, 'dataChannelOpenListener');
      var addDataChannelOpenListener = tmp.addListener,
        removeDataChannelOpenListener = tmp.removeListener;
      tmp = (function() {
        var listener = listenerFactory(easyrtc.setPeerListener, 'peerListener');
        return {
          addListener: function(callback, acceptMsgType) {
            var decoratedCallback = function(easyrtcid, msgType, msgData, targeting) {
              if (acceptMsgType === undefined || msgType === acceptMsgType) {
                callback.apply(this, arguments);
              }
            };
            listener.addListener(decoratedCallback);
            return decoratedCallback;
          },
          removeListener: function(callback) {
            listener.removeListener(callback);
          }
        };
      })();
      var addPeerListener = tmp.addListener,
        removePeerListener = tmp.removeListener;
      tmp = listenerFactory(easyrtc.setDataChannelCloseListener, 'dataChanelCloseListener');
      var addDataChannelCloseListener = tmp.addListener,
        removeDataChannelCloseListener = tmp.removeListener;

      return {
        leaveRoom: leaveRoom,
        performCall: performCall,
        connect: connect,
        canEnumerateDevices: canEnumerateDevices,
        enableMicrophone: enableMicrophone,
        muteRemoteMicrophone: muteRemoteMicrophone,
        enableCamera: enableCamera,
        enableVideo: enableVideo,
        isVideoEnabled: isVideoEnabled,
        configureBandwidth: configureBandwidth,
        setPeerListener: setPeerListener,
        myRtcid: myEasyrtcid,
        broadcastData: broadcastData,
        broadcastMe: broadcastMe,
        addDisconnectCallback: addDisconnectCallback,
        removeDisconnectCallback: removeDisconnectCallback,
        sendDataP2P: sendDataP2P,
        sendDataWS: sendDataWS,
        sendData: sendData,
        getP2PConnectionStatus: getP2PConnectionStatus,
        doesDataChannelWork: doesDataChannelWork,
        setGotMedia: setGotMedia,
        NOT_CONNECTED: easyrtc.NOT_CONNECTED,
        BECOMING_CONNECTED: easyrtc.BECOMING_CONNECTED,
        IS_CONNECTED: easyrtc.IS_CONNECTED,
        addDataChannelOpenListener: addDataChannelOpenListener,
        addDataChannelCloseListener: addDataChannelCloseListener,
        removeDataChannelOpenListener: removeDataChannelOpenListener,
        removeDataChannelCloseListener: removeDataChannelCloseListener,
        addPeerListener: addPeerListener,
        removePeerListener: removePeerListener,
        connection: connection,
        getOpenedDataChannels: getOpenedDataChannels
      };
    }]);
