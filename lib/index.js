'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var createDriver = exports.createDriver = function createDriver(options) {
  var createResponse$ = options.createResponse$;
  var _options$requestProp = options.requestProp;
  var requestProp = _options$requestProp === undefined ? 'request' : _options$requestProp;
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
  var isolateMap = _options$isolateMap === undefined ? function (_) {
    return _;
  } : _options$isolateMap;
  var isolateSink = options.isolateSink;
  var isolateSource = options.isolateSource;


  if (typeof options == 'function') {
    createResponse$ = options;
  } else if (!createResponse$) {
    throw new Error('createResponse$ method should be provided.');
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
      var response$ = createResponse$(reqOptions);
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
