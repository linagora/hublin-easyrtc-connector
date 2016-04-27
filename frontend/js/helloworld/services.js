'use strict';

angular.module('esn.helloworld')
  .factory('getHelloWorld', function($http) {
    return $http.get('/helloworld/api/sayhello').then(function(response) {
      return response.data.message;
    });
  });
