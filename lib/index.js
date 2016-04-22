'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createDriver = exports.makeAsyncDriver = exports.isPromise = exports.isObservable = undefined;

var _rx = require('rx');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// not using `instanceOf` because for linked npm modules
// `Observable` and `Promise` will be different
var isObservable = exports.isObservable = function isObservable(response$) {
  return typeof response$.subscribe === 'function';
};

var isPromise = exports.isPromise = function isPromise(response$) {
  return typeof response$.then === 'function';
};

var createResponse$FromGetResponse = function createResponse$FromGetResponse(getResponse, reqOptions) {
  var p = void 0;
  var promise = new Promise(function (resolve, reject) {
    p = { resolve: resolve, reject: reject };
  });
  var callback = function callback(err, result) {
    err ? p.reject(err) : p.resolve(result);
  };
  var response$ = getResponse(reqOptions, callback);
  if (!response$ || !isObservable(response$)) {
    if (response$ && isPromise(response$)) {
      promise = response$;
    }
    response$ = _rx.Observable.fromPromise(promise);
  }
  return response$;
};

var makeAsyncDriver = exports.makeAsyncDriver = function makeAsyncDriver(options) {
  var createResponse$ = options.createResponse$;
  var getResponse = options.getResponse;
  var _options$requestProp = options.requestProp;
  var requestProp = _options$requestProp === undefined ? 'request' : _options$requestProp;
  var _options$responseProp = options.responseProp;
  var responseProp = _options$responseProp === undefined ? false : _options$responseProp;
  var _options$normalizeReq = options.normalizeRequest;
  var normalizeRequest = _options$normalizeReq === undefined ? function (_) {
    return _;
  } : _options$normalizeReq;
  var _options$eager = options.eager;
  var eager = _options$eager === undefined ? true : _options$eager;
  var _options$isolate = options.isolate;
  var isolate = _options$isolate === undefined ? true : _options$isolate;
  var _options$isolateProp = options.isolateProp;
  var isolateProp = _options$isolateProp === undefined ? '_namespace' : _options$isolateProp;
  var _options$isolateMap = options.isolateMap;
  var isolateMap = _options$isolateMap === undefined ? null : _options$isolateMap;
  var isolateSink = options.isolateSink;
  var isolateSource = options.isolateSource;


  if (responseProp === true) {
    responseProp = 'response';
  }
  if (typeof normalizeRequest !== 'function') {
    throw new Error('\'normalize\' option should be a function.');
  }
  if (normalizeRequest && !isolateMap) {
    isolateMap = normalizeRequest;
  }

  if (typeof options == 'function') {
    getResponse = options;
  } else if (!createResponse$ && !getResponse) {
    throw new Error('\'createResponse$\' or \'getResponse\' method should be provided.');
  }

  function _isolateSink(request$, scope) {
    return request$.map(function (req) {
      req = isolateMap(req);
      req[isolateProp] = req[isolateProp] || [];
      req[isolateProp].push(scope);
      return req;
    });
  }

  function _isolateSource(response$$, scope) {
    var isolatedResponse$$ = response$$.filter(function (res$) {
      return Array.isArray(res$[requestProp][isolateProp]) && res$[requestProp][isolateProp].indexOf(scope) !== -1;
    });
    isolatedResponse$$.isolateSource = _isolateSource;
    isolatedResponse$$.isolateSink = _isolateSink;
    return isolatedResponse$$;
  }

  return function driver(request$) {
    var response$$ = request$.map(function (request) {
      var reqOptions = normalizeRequest(request);
      var response$ = void 0;
      if (createResponse$) {
        response$ = createResponse$(reqOptions);
      } else {
        response$ = createResponse$FromGetResponse(getResponse, reqOptions);
      }

      response$ = responseProp ? response$.map(function (response) {
        var _ref;

        return _ref = {}, _defineProperty(_ref, responseProp, response), _defineProperty(_ref, requestProp, request), _ref;
      }).catch(function (error) {
        throw _defineProperty({
          error: error
        }, requestProp, request);
      }) : response$;

      if (typeof reqOptions.eager === 'boolean' ? reqOptions.eager : eager) {
        response$ = response$.replay(null, 1);
        response$.connect();
      }
      if (requestProp) {
        Object.defineProperty(response$, requestProp, {
          value: reqOptions,
          writable: false
        });
      }

      return response$;
    }).replay(null, 1);
    response$$.connect();
    if (isolate) {
      response$$.isolateSource = isolateSource || _isolateSource;
      response$$.isolateSink = isolateSink || _isolateSink;
    }
    return response$$;
  };
};

exports.createDriver = makeAsyncDriver;
exports.default = makeAsyncDriver;