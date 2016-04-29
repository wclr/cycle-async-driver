'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.attachPull = exports.attachDispose = exports.makeRequest$ = undefined;

var _rx = require('rx');

var _util = require('./util');

var makeRequest$ = exports.makeRequest$ = function makeRequest$(request, sampler$) {
  var request$ = void 0;
  if (!request) {
    throw new Error('valid request object or request$ stream should be provided');
  }
  if ((0, _util.isObservable)(request)) {
    request$ = request;
  } else if (sampler$) {
    if ((0, _util.isObservable)(sampler$)) {
      request$ = sampler$.map(function (_) {
        return request;
      });
    } else {
      throw new Error('sampler should be a stream');
    }
  } else {
    request$ = _rx.Observable.just(request);
  }
  return request$;
};

var attachDispose = exports.attachDispose = function attachDispose(response$$, subs) {
  var _dispose = response$$.dispose;
  response$$.dispose = function () {
    _dispose && _dispose.apply(response$$, arguments);
    subs.forEach(function (sub) {
      return sub.dispose();
    });
  };
  return response$$;
};

var attachPull = exports.attachPull = function attachPull(driver, helperName) {
  var scopePrefix = arguments.length <= 2 || arguments[2] === undefined ? 'pull_scope_' : arguments[2];
  return function (request$) {
    var allRequests$ = new _rx.Subject();
    var scopeCounter = 0;

    var response$$ = driver(allRequests$);
    var isolateSink = response$$.isolateSink;
    var isolateSource = response$$.isolateSource;

    var driverScope = scopePrefix + scopeCounter;

    var subs = [isolateSink(request$, driverScope).subscribe(allRequests$.onNext.bind(allRequests$))];
    var driverResponse$$ = isolateSource(response$$, driverScope);

    driverResponse$$[helperName] = function (request, sampler$) {
      var request$ = makeRequest$(request, sampler$);
      var scope = scopePrefix + ++scopeCounter;
      subs.push(isolateSink(request$, scope).subscribe(allRequests$.onNext.bind(allRequests$)));
      return isolateSource(response$$, scope);
    };
    return attachDispose(driverResponse$$, subs);
  };
};