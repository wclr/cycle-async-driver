'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var methodsToProxy = ['filter', 'map', 'first', 'last', 'delay', 'throttle', 'concat', 'sample', 'withLatestFrom', 'zip', 'combineLatest', 'skip', 'skipLast', 'skipLastWithTime', 'skipUntil', 'skipUntilWithTime', 'skipWhile', 'skipWithTime', 'take', 'takeLast', 'takeLastWithTime', 'takeUntil', 'takeUntilWithTime', 'takeWhile', 'takeWithTime'];

var proxyAndKeepMethods = exports.proxyAndKeepMethods = function proxyAndKeepMethods(response$$, methodsToKeep) {
  methodsToProxy.forEach(function (methodToProxy) {
    var _oldMethod = response$$[methodToProxy];
    response$$[methodToProxy] = function () {
      var result = _oldMethod.apply(response$$, arguments);
      proxyAndKeepMethods(result, methodsToKeep);
      methodsToKeep.forEach(function (methodToKeep) {
        result[methodToKeep] = response$$[methodToKeep];
      });

      return result;
    };
  });
  return response$$;
};