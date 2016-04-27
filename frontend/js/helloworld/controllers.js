'use strict';

angular.module('esn.helloworld')
  .controller('helloWorldController', function($scope, getHelloWorld) {
    getHelloWorld.then(function(message) {
      $scope.message = message;
    });
  });
