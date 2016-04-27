'use strict';

angular.module('esn.helloworld')
  .directive('applicationMenuHelloWorld', function(applicationMenuTemplateBuilder) {
    return {
      retrict: 'E',
      replace: true,
      template: applicationMenuTemplateBuilder('/#/helloworld', 'mdi-thumb-up', 'My Module')
    };
  });
