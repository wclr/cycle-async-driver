'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.attachPullDriver = undefined;

var _rx = require('rx');

var _attachPull = require('./attachPull');

var attachPullDriver = exports.attachPullDriver = function attachPullDriver(driver, helperName) {
  return function (request$) {
    var subs = [];
    var response$$ = driver(request$);
    response$$[helperName] = function (request, sampler$) {
      var request$ = (0, _attachPull.makeRequest$)(request, sampler$);
      var sink = new _rx.ReplaySubject(1);
      subs.push(request$.subscribe(sink));
      return driver(sink);
    };
    return (0, _attachPull.attachDispose)(response$$, subs);
  };
};