'use strict';

/* global chai: false */

var expect = chai.expect;

var DummyCallbackConstructor = function() {
  var callback;
  return {
    setCallback: function(cb) {
      callback = cb;
    },
    callCallback: function() {
      callback.apply(this, arguments);
    }
  };
};

describe('easyRTCAdapter service', function() {
  var service, tokenAPI, session, webrtcFactory, easyrtc, currentConferenceState, disconnectCallback, $rootScope, $scope, easyRTCBitRates;

  beforeEach(function() {
    angular.mock.module('hublin.easyrtc.connector');
  });

  beforeEach(function() {
    var dummyDataOpenListener = new DummyCallbackConstructor(),
      dummyDataCloseListener = new DummyCallbackConstructor(),
      dummyPeerListener = new DummyCallbackConstructor();
    currentConferenceState = {};

    easyrtc = {
      setGotMedia: function() {},
      setDataChannelOpenListener: dummyDataOpenListener.setCallback,
      setDataChannelCloseListener: dummyDataCloseListener.setCallback,
      setPeerListener: dummyPeerListener.setCallback,
      setRoomOccupantListener: function() {},
      setRoomEntryListener: function() {},
      addDataChannelOpenListener: function() {},
      addDataChannelCloseListener: function() {},
      setCallCancelled: function() {},
      setOnStreamClosed: function() {},
      getVideoSourceList: function() {},
      enableDataChannels: function() {},
      useThisSocketConnection: function() {},
      setOnError: function() {},
      setVideoDims: function() {},
      setOnCall: function() {},
      setOnHangup: function() {},
      setDisconnectListener: function(callback) { disconnectCallback = callback; },
      myEasyrtcid: 'myself',
      extra: {
        callDataChannelOpenListener: dummyDataOpenListener.callCallback,
        callDataChannelCloseListener: dummyDataCloseListener.callCallback,
        callPeerListener: dummyPeerListener.callCallback
      },
      setMaxP2PMessageLength: function() {}
    };
    tokenAPI = {};
    session = {
      getUsername: function() { return 'Wooot'; },
      getUserId: function() { return 2; },
      user: {
        _id: 2,
        emails: ['test@openpaas.io']
      },
      domain: {
        _id: 123
      }
    };
    webrtcFactory = {
      get: function() {
        return easyrtc;
      }
    };
    easyRTCBitRates = {
      low: {
        audio: 20,
        video: 30
      },
      medium: {
        audio: 40,
        video: 60
      },
      nolimit: null
    };

    module(function($provide) {
      $provide.value('tokenAPI', {});
      $provide.value('session', session);
      $provide.value('webrtcFactory', webrtcFactory);
      $provide.value('ioSocketConnection', {
        isConnected: function() { return true; },
        addConnectCallback: function() {},
        getSio: function() { return {}; }
      });
      $provide.value('ioConnectionManager', {});
      $provide.value('currentConferenceState', currentConferenceState);
      $provide.value('easyRTCBitRates', easyRTCBitRates);
      $provide.value('LOCAL_VIDEO_ID', 'video-thumb0');
      $provide.value('REMOTE_VIDEO_IDS', []);
      $provide.value('EASYRTC_APPLICATION_NAME', 'LiveConference');
      $provide.value('EASYRTC_EVENTS', {});
      $provide.value('MAX_P2P_MESSAGE_LENGTH', 10000);
    });

    inject(function($injector, _$rootScope_) {
      service = $injector.get('easyRTCAdapter');
      $rootScope = _$rootScope_;
      $scope = $rootScope.$new();
    });
  });

  describe('broadcastData function', function() {

    it('should do nothing if easyrtc.getRoomOccupantsAsArray fails to return the occupants', function() {
      easyrtc.getRoomOccupantsAsArray = function() { return null; };
      easyrtc.sendData = function() { throw new Error('This test should not call easyrtc.sendData'); };

      service.broadcastData('', {});
    });

    it('should call easyrtc.sendData on each occupant except myself', function() {
      var calledIds = [];

      easyrtc.getRoomOccupantsAsArray = function() { return ['myself', 'other1', 'other2']; };
      easyrtc.sendData = function(easyrtcid, event, data) {
        expect(event).to.equal('message');
        expect(data).to.deep.equal({ da: 'ta' });

        calledIds.push(easyrtcid);
      };

      service.broadcastData('message', { da: 'ta' });

      expect(calledIds).to.deep.equal(['other1', 'other2']);
    });

  });

  describe('broadcastMe function', function() {

    it('should call broadcastData with a prepared attendee', function() {
      currentConferenceState.getAttendeeByRtcid = function() {
        return {
          index: 0,
          videoId: 'videoId',
          id: 'id',
          rtcid: 'easyrtcid',
          displayName: 'displayName',
          avatar: 'avatar',
          mute: true,
          muteVideo: false,
          speaking: false,
          timezoneOffset: 120,
          foo: 'bar'
        };
      };
      easyrtc.getRoomOccupantsAsArray = function() { return ['myself', 'other1', 'other2']; };
      easyrtc.sendData = function(easyrtcid, event, data) {
        expect(data).to.deep.equal({
          id: 'id',
          easyrtcid: 'easyrtcid',
          displayName: 'displayName',
          avatar: 'avatar',
          mute: true,
          muteVideo: false,
          speaking: false,
          timezoneOffset: 120
        });
      };

      service.broadcastMe();
    });

    it('should do nothing if attendee cannot be found', function() {
      currentConferenceState.getAttendeeByRtcid = function() { return null; };
      easyrtc.getRoomOccupantsAsArray = function() {
        throw new Error('This test should not call easyrtc.getRoomOccupantsAsArray.');
      };

      service.broadcastMe();
    });

  });

  describe('addDisconnectCallback function', function() {

    it('should return false if no callback is given', function() {
      expect(service.addDisconnectCallback()).to.be.false;
    });

    it('should register a new disconnect callback', function(done) {
      service.addDisconnectCallback(done);

      disconnectCallback();
    });

    it('should return an identifier for the registered callback', function() {
      expect(service.addDisconnectCallback(function() {})).to.exist;
    });

  });

  describe('removeDisconnectCallback function', function() {

    it('should return false if no id is given', function() {
      expect(service.removeDisconnectCallback()).to.be.false;
    });

    it('should remove an existing disconnect callback', function() {
      var id = service.addDisconnectCallback(function() {
        throw new Error('This test should not call any disconnect callback !');
      });

      service.removeDisconnectCallback(id);
      disconnectCallback();
    });

  });

  describe('setGotMedia function', function() {

    it('should proxy to easyrtc.setGotMedia()', function(done) {

      var callback = function() {
      };

      easyrtc.setGotMedia = function(arg) {
        expect(arg).to.equal(callback);
        done();
      };
      service.setGotMedia(callback);
    });
  });

  describe('leaveRoom function', function() {

    it('should call stopLocalStream to stop all tracks', function() {
      var stopSpy = chai.spy();
      var conference = { _id: 'conference_id' };
      easyrtc.getLocalStream = function() {
        return {
          getTracks: function() {
            return [{
              stop: stopSpy
            }, {
              stop: stopSpy
            }];
          }
        };
      };
      easyrtc.leaveRoom = function(id) {
        expect(id).to.equal(conference._id);
      };
      service.leaveRoom(conference);
      expect(stopSpy).to.have.been.called.twice;
    });

  });

  describe('sendData function', function() {

    it('should forward the call to easyrtc.sendData', function(done) {
      var testId = 'anId';
      var testMsgType = 'aType';
      var testData = {
        toto: 'titi',
        tata: {}
      };
      var testHandler = function() {};

      easyrtc.sendData = function(easyrtcid, msgType, data, ackhandler) {
        expect(easyrtcid).to.equal(testId);
        expect(msgType).to.equal(testMsgType);
        expect(data).to.equal(testData);
        expect(ackhandler).to.deep.equal(testHandler);
        done();
      };

      service.sendData(testId, testMsgType, testData, testHandler);
    });
  });

  [
    {
      name: 'DataChannelOpen listener',
      remove: 'removeDataChannelOpenListener',
      add: 'addDataChannelOpenListener',
      call: 'callDataChannelOpenListener'
    },
    {
      name: 'DataChannelClose listener',
      add: 'addDataChannelCloseListener',
      remove: 'removeDataChannelCloseListener',
      call: 'callDataChannelCloseListener'
    },
    {
      name: 'peer listener',
      add: 'addPeerListener',
      remove: 'removePeerListener',
      call: 'callPeerListener'
    }
  ].forEach(function(listener) {
      describe('add/remove ' + listener.name + ' functions', function() {
        it('should call the function on each event', function(done) {
          var callMe = chai.spy(),
            callMeToo = chai.spy();
          service[listener.add](callMe);
          service[listener.add](callMeToo);

          expect(callMe).to.have.been.called.exactly(0);
          expect(callMeToo).to.have.been.called.exactly(0);

          easyrtc.extra[listener.call]();
          expect(callMe).to.have.been.called.once;
          expect(callMeToo).to.have.been.called.once;

          easyrtc.extra[listener.call]();
          expect(callMe).to.have.been.called.twice;
          expect(callMeToo).to.have.been.called.twice;

          done();
        });

        it('should remove listener', function(done) {
          var callMe = chai.spy(), removeMe;
          removeMe = service[listener.add](callMe);
          expect(callMe).to.have.been.called.exactly(0);

          easyrtc.extra[listener.call]();
          expect(callMe).to.have.been.called.once;

          service[listener.remove](removeMe);
          easyrtc.extra[listener.call]();
          expect(callMe).to.have.been.called.once;

          done();
        });
      });
    });

  describe('addPeerListener', function() {

    it('should only accept one type of message', function(done) {
      var callMe = chai.spy(), goodMsgType = 'foo',
        badMsgType = 'bar';
      service.addPeerListener(callMe, goodMsgType);

      easyrtc.extra.callPeerListener('someRtcId', goodMsgType,
        'some data', 'someRtcId as target');
      easyrtc.extra.callPeerListener('someRtcId', badMsgType,
        'some data', 'someRtcId as target');

      expect(callMe).to.have.been.called.once;
      done();
    });

  });

  describe('connection promise', function() {
    var callMe, dontCallMe;

    beforeEach(function() {
      callMe = chai.spy(),
      dontCallMe = chai.spy(),
      currentConferenceState = {
        conference: {
          _id: null
        },
        pushAttendee: function() {},
        updateMuteVideoFromIndex: function() {},
        updateTimezoneOffsetFromIndex: function() {}
      };
      easyrtc.roomJoin = [];
      easyrtc.joinRoom = function() {};
    });

    it('should do nothing if no connection starts', function(done) {
      service.connection().then(callMe, dontCallMe);

      expect(callMe).to.have.been.called.exactly(0);
      expect(dontCallMe).to.have.been.called.exactly(0);

      done();
    });

    it('should fullfill a lately defined promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginSuccess();
      };

      service.connect(currentConferenceState);
      service.connection().then(function() { done(); },
        function() { });

      $scope.$apply();
    });

    it('should fullfill a previous promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginSuccess();
      };

      service.connection().then(function() { done();},
        function() {});
      service.connect(currentConferenceState);

      $scope.$apply();
    });

    it('should fail a lately defined promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginFailure('Some error');
      };

      service.connect(currentConferenceState);
      service.connection().then(function() { },
        function() { done(); });

      $scope.$apply();
    });

    it('should fail a previously defined promise on success', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginFailure('Some error');
      };

      service.connection().then(function() { },
        function() { done(); });
      service.connect(currentConferenceState);

      $scope.$apply();
    });

    it('should accept multiple callbacks', function(done) {
      easyrtc.easyApp = function(EASYRTC_APPLICATION_NAME,
                                 LOCAL_VIDEO_ID,
                                 REMOTE_VIDEO_IDS,
                                 onLoginSuccess,
                                 onLoginFailure) {
        onLoginSuccess();
      };

      service.connection().then(callMe, dontCallMe);
      service.connect(currentConferenceState);
      service.connection().then(callMe, dontCallMe);

      $scope.$apply();

      expect(callMe).to.have.been.called.twice;
      expect(dontCallMe).to.have.been.called.exactly(0);

      done();

    });
  });

  describe('getOpenedDataChannels function', function() {

    it('should list all opened data channels', function(done) {
      var peerList = ['myself', 'other1', 'other2', 'other3'];
      easyrtc.getRoomOccupantsAsArray = function() { return peerList; };
      easyrtc.doesDataChannelWork = function(peer) {
        if (peerList.indexOf(peer) < 2) {
          return true;
        } else {
          return false;
        }
      };

      var channels = service.getOpenedDataChannels();
      expect(channels.length).to.equal(2);
      done();
    });

  });
});

describe('listenerFactory factory', function() {
  var service, dummyCallback, listen, emptyFunction;

  beforeEach(angular.mock.module('hublin.easyrtc.connector'));

  beforeEach(function() {
    inject(function($injector) {
      service = $injector.get('listenerFactory');
    });

    dummyCallback = new DummyCallbackConstructor();
    listen = service(dummyCallback.setCallback);
    emptyFunction = function() { };
  });

  it('should return an object', function(done) {
    expect(listen.addListener).to.be.a('function');
    expect(listen.removeListener).to.be.a('function');
    done();
  });

  describe('addListener function', function() {

    it('should return the last added function', function(done) {
      expect(listen.addListener(emptyFunction)).to.equal(emptyFunction);
      done();
    });

  });

  it('should call each callback once', function(done) {

    var callOnce = chai.spy(),
      callTwice = chai.spy();

    listen.addListener(callOnce);
    listen.addListener(callTwice);
    listen.addListener(callTwice);

    dummyCallback.callCallback();

    expect(callOnce).to.have.been.called.once;
    expect(callTwice).to.have.been.called.twice;
    done();
  });

  it('should be able to remove callbacks', function(done) {
    var callOnce = chai.spy(),
      callTwice = chai.spy();

    listen.addListener(callTwice);
    listen.addListener(callTwice);
    listen.addListener(callTwice);

    listen.addListener(callOnce);
    listen.removeListener(callTwice);

    dummyCallback.callCallback();

    expect(callOnce).to.have.been.called.once;
    expect(callTwice).to.have.been.called.twice;
    done();
  });
});

describe('conferenceState easyrtc service', function() {
    var service, $q, $rootScope, $log, tokenAPI, session, webrtcFactory, webrtcObject, easyRTCBitRates;

    beforeEach(function() {
      angular.mock.module('hublin.easyrtc.connector');
    });

    beforeEach(function() {
      tokenAPI = {};
      $log = {
        debug: function() {}
      };
      session = {
        getUsername: function() {
          return 'Wooot';
        },
        getUserId: function() {
          return 2;
        },
        user: {
          _id: 2,
          emails: ['test@openpaas.io']
        },
        domain: {
          _id: 123
        }
      };
      easyRTCBitRates = {
        low: {
          audio: 20,
          video: 30
        },
        medium: {
          audio: 40,
          video: 60
        },
        nolimit: null
      };

      webrtcObject = {
        roomJoin: {},

        setRoomOccupantListener: function() {},
        setRoomEntryListener: function() {},
        setDisconnectListener: function() {},
        joinRoom: function() {},
        easyApp: function() {},
        hangupAll: function() {},
        setOnCall: function() {},
        setOnHangup: function() {},
        useThisSocketConnection: function() {},
        enableDataChannels: function() {},
        setPeerListener: function() {},
        sendDataP2P: function() {},
        sendDataWS: function() {},
        getConnectStatus: function() {},
        getVideoSourceList: function() {},
        doesDataChannelWork: function() {},
        setDataChannelCloseListener: function() {},
        setCallCancelled: function() {},
        setOnStreamClosed: function() {},
        setOnError: function() {},
        setVideoDims: function() {},
        setMaxP2PMessageLength: function() {}
      };

      webrtcFactory = {
        get: function() {
          return webrtcObject;
        }
      };

      var ioSocketConnection = {
        isConnected: function() {
          return true;
        },
        getSio: function() {
          return this.sio;
        },
        addConnectCallback: function(callback) {
          this.connectCallback = callback;
        },
        addDisconnectCallback: function() {}
      };
      this.ioSocketConnection = ioSocketConnection;

      var ioConnectionManager = {
      };
      this.ioConnectionManager = ioConnectionManager;

      module(function($provide) {
        $provide.value('$log', $log);
        $provide.value('tokenAPI', tokenAPI);
        $provide.value('session', session);
        $provide.value('webrtcFactory', webrtcFactory);
        $provide.value('ioSocketConnection', ioSocketConnection);
        $provide.value('ioConnectionManager', ioConnectionManager);
        $provide.value('currentConferenceState', {});
        $provide.value('easyRTCBitRates', easyRTCBitRates);
        $provide.value('LOCAL_VIDEO_ID', 'video-thumb0');
        $provide.value('REMOTE_VIDEO_IDS', []);
        $provide.value('EASYRTC_APPLICATION_NAME', 'LiveConference');
        $provide.value('EASYRTC_EVENTS', {});
        $provide.value('MAX_P2P_MESSAGE_LENGTH', 10000);
      });
    });

    describe('performCall() method', function() {
      it('should hangupAll', function(done) {
        webrtcObject.hangupAll = function() {
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });

        inject(function($injector) {
          service = $injector.get('easyRTCAdapter');
        });

        service.performCall('YOLO');
      });

      it('should call the given user id', function(done) {
        var user_id = 123;
        webrtcObject.call = function(id) {
          expect(id).to.equal(user_id);
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });

        inject(function($injector) {
          service = $injector.get('easyRTCAdapter');
        });

        service.performCall(user_id);
      });
    });

    describe('connect() method', function() {
      it('should create the easyRTC app when the socketIO connection becomes available', function(done) {
        this.ioSocketConnection.sio = {};
        this.ioSocketConnection.isConnected = function() {
          return false;
        };
        webrtcObject.easyApp = function() {
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });

        inject(function($injector, _$q_, _$rootScope_) {
          service = $injector.get('easyRTCAdapter');
          $q = _$q_;
          $rootScope = _$rootScope_;
        });

        var conferenceState = {
          conference: {
            conference: { _id: 123 }
          },
          pushAttendee: function() {},
          removeAttendee: function() {}
        };
        service.connect(conferenceState);
        expect(this.ioSocketConnection.connectCallback).to.be.a('function');
        this.ioSocketConnection.connectCallback();
      });

      it('should give the socketIO instance to easyrtc', function(done) {
        var self = this;
        this.ioSocketConnection.isConnected = function() {
          return true;
        };
        this.ioSocketConnection.sio = {websocket: true};
        webrtcObject.useThisSocketConnection = function(sio) {
          expect(sio).to.deep.equal(self.ioSocketConnection.sio);
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });

        inject(function($injector, _$q_, _$rootScope_) {
          service = $injector.get('easyRTCAdapter');
          $q = _$q_;
          $rootScope = _$rootScope_;
        });

        var conferenceState = {
          conference: { _id: 123 },
          pushAttendee: function() {},
          removeAttendee: function() {}
        };
        service.connect(conferenceState);
      });

      it('should create the easyRTC app if the socketIO connection is available', function(done) {
        var self = this;
        this.ioSocketConnection.sio = {};
        this.ioSocketConnection.isConnected = function() {
          self.ioSocketConnection.addConnectCallback = function(cb) {
            return done(new Error('I should not be called ' + cb));
          };
          return true;
        };
        webrtcObject.easyApp = function() {
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });

        inject(function($injector, _$q_, _$rootScope_) {
          service = $injector.get('easyRTCAdapter');
          $q = _$q_;
          $rootScope = _$rootScope_;
        });

        var conferenceState = {
          conference: { _id: 123 },
          pushAttendee: function() {},
          removeAttendee: function() {}
        };
        service.connect(conferenceState);
        expect(this.ioSocketConnection.connectCallback).to.be.a('function');
        this.ioSocketConnection.connectCallback();
      });
    });

    describe('sendDataP2P() method', function() {
      it('should forward the call to easyrtc.sendDataP2P(), JSON encoding the data', function(done) {
        var id = 'easyrtcid1', type = 'msgtype1', data = 'data1', service;
        webrtcObject.sendDataP2P = function(idarg, typearg, dataarg) {
          expect(idarg).to.equal(id);
          expect(typearg).to.equal(type);
          expect(dataarg).to.equal(data);
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });
        inject(function(easyRTCAdapter) {
          service = easyRTCAdapter;
        });
        service.sendDataP2P(id, type, data);
      });
    });

    describe('sendDataWS() method', function() {
      it('should forward the call to easyrtc.sendDataWS(), JSON encoding the data', function(done) {
        var id = 'easyrtcid1', type = 'msgtype1', data = 'data1', service;
        webrtcObject.sendDataWS = function(idarg, typearg, dataarg) {
          expect(idarg).to.equal(id);
          expect(typearg).to.equal(type);
          expect(dataarg).to.equal(data);
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });
        inject(function(easyRTCAdapter) {
          service = easyRTCAdapter;
        });
        service.sendDataWS(id, type, data);
      });
    });

    describe('getP2PConnectionStatus() method', function() {
      it('should forward the call to easyrtc.getConnectStatus()', function(done) {
        var id = 'easyrtcid1', service;
        webrtcObject.getConnectStatus = function(idarg) {
          expect(idarg).to.equal(id);
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });
        inject(function(easyRTCAdapter) {
          service = easyRTCAdapter;
        });
        service.getP2PConnectionStatus(id);
      });
    });

    describe('doesDataChannelWork() method', function() {
      it('should forward the call to easyrtc.doesDataChannelWork()', function(done) {
        var id = 'easyrtcid1', service;
        webrtcObject.doesDataChannelWork = function(idarg) {
          expect(idarg).to.equal(id);
          done();
        };
        module(function($provide) {
          $provide.value('webrtcFactory', webrtcFactory);
        });
        inject(function(easyRTCAdapter) {
          service = easyRTCAdapter;
        });
        service.doesDataChannelWork(id);
      });
    });

    it('shoud expose easyrtc connection constants', function() {
      var service, easyrtc;
      inject(function(easyRTCAdapter, webrtcFactory) {
        service = easyRTCAdapter;
        easyrtc = webrtcFactory.get();
      });
      expect(service.NOT_CONNECTED).to.equal(easyrtc.NOT_CONNECTED);
      expect(service.BECOMING_CONNECTED).to.equal(easyrtc.BECOMING_CONNECTED);
      expect(service.IS_CONNECTED).to.equal(easyrtc.IS_CONNECTED);
    });
  });
