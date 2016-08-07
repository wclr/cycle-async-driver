'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var isPromise = function isPromise(p) {
  return typeof p.then === 'function';
};

var getResponsePromise = function getResponsePromise(getResponse, request, abortCallback) {
  var callbackResult = void 0;
  var callbackPromise = void 0;
  var handleCallback = function handleCallback() {
    var _callbackResult = callbackResult;
    var err = _callbackResult.err;
    var result = _callbackResult.result;

    err ? callbackPromise.reject(err) : callbackPromise.resolve(result);
  };
  var callback = function callback(err, result) {
    callbackResult = { err: err, result: result };
    callbackPromise && handleCallback();
  };
  var res = getResponse(request, callback, abortCallback);
  if (res && isPromise(res)) {
    return res;
  } else {
    return new Promise(function (resolve, reject) {
      callbackPromise = { resolve: resolve, reject: reject };
      callbackResult && handleCallback();
    });
  }
};

exports.default = getResponsePromise;