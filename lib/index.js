'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createDriver = exports.makeAsyncDriver = exports.attachHelpers = exports.attachSelectorHelper = exports.attachFlattenHelpers = exports.failed = exports.successful = exports.proxyAndKeepMethods = exports.isPromise = exports.isObservable = undefined;

var _rx = require('rx');

var _proxyMethods = require('./proxy-methods');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// not using `instanceOf` because for linked npm modules
// `Observable` and `Promise` will be different
var isObservable = exports.isObservable = function isObservable(response$) {
  return typeof response$.subscribe === 'function';
};

var isPromise = exports.isPromise = function isPromise(response$) {
  return typeof response$.then === 'function';
};

exports.proxyAndKeepMethods = _proxyMethods.proxyAndKeepMethods;
var successful = exports.successful = function successful(r$$, selector) {
  return r$$.flatMap(function (r$) {
    return (selector ? r$.map(selector) : r$).catch(_rx.Observable.empty());
  });
};

var failed = exports.failed = function failed(r$$, selector) {
  return r$$.flatMap(function (r$) {
    return r$.skip().catch(function (e) {
      return _rx.Observable.of(selector ? selector(e) : e);
    });
  });
};

var attachFlattenHelpers = exports.attachFlattenHelpers = function attachFlattenHelpers(r$$) {
  var flattenHelpers = arguments.length <= 1 || arguments[1] === undefined ? ['successful', 'failed'] : arguments[1];

  r$$[flattenHelpers[0]] = function (selector) {
    return successful(this, selector);
  };
  r$$[flattenHelpers[1]] = function (selector) {
    return failed(this, selector);
  };
};

var attachSelectorHelper = exports.attachSelectorHelper = function attachSelectorHelper(r$$, _ref) {
  var _ref$selectorMethod = _ref.selectorMethod;
  var selectorMethod = _ref$selectorMethod === undefined ? 'select' : _ref$selectorMethod;
  var _ref$selectorProp = _ref.selectorProp;
  var selectorProp = _ref$selectorProp === undefined ? 'category' : _ref$selectorProp;
  var _ref$requestProp = _ref.requestProp;
  var requestProp = _ref$requestProp === undefined ? 'request' : _ref$requestProp;

  r$$[selectorMethod] = function (match) {
    var test = match instanceof RegExp ? match.test.bind(match) : function (_) {
      return match === _;
    };
    return this.filter(function (r$) {
      return test(r$[requestProp][selectorProp]);
    });
  };
  return r$$;
};

var attachHelpers = exports.attachHelpers = function attachHelpers(r$$) {
  var _ref2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var _ref2$flatten = _ref2.flatten;
  var flatten = _ref2$flatten === undefined ? true : _ref2$flatten;
  var _ref2$selector = _ref2.selector;
  var selector = _ref2$selector === undefined ? true : _ref2$selector;
  var _ref2$keepMethods = _ref2.keepMethods;
  var keepMethods = _ref2$keepMethods === undefined ? true : _ref2$keepMethods;

  flatten && attachFlattenHelpers(r$$);
  selector && attachSelectorHelper(r$$);
  if (keepMethods) {
    return (0, _proxyMethods.proxyAndKeepMethods)(r$$, ['isolateSink', 'isolateSource', 'select', 'successful', 'failed']);
  }
  return r$$;
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
  var _options$selectorMeth = options.selectorMethod;
  var selectorMethod = _options$selectorMeth === undefined ? 'select' : _options$selectorMeth;
  var _options$selectorProp = options.selectorProp;
  var selectorProp = _options$selectorProp === undefined ? 'category' : _options$selectorProp;
  var _options$flattenHelpe = options.flattenHelpers;
  var flattenHelpers = _options$flattenHelpe === undefined ? ['successful', 'failed'] : _options$flattenHelpe;


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
    //isolatedResponse$$.isolateSource = _isolateSource
    //isolatedResponse$$.isolateSink = _isolateSink
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
        var _ref3;

        return _ref3 = {}, _defineProperty(_ref3, responseProp, response), _defineProperty(_ref3, requestProp, reqOptions), _ref3;
      }).catch(function (error) {
        throw _defineProperty({
          error: error
        }, requestProp, reqOptions);
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

    var methodsToKeep = [];

    if (isolate) {
      response$$.isolateSource = isolateSource || _isolateSource;
      response$$.isolateSink = isolateSink || _isolateSink;
      methodsToKeep.push('isolateSink', 'isolateSource');
    }

    if (Array.isArray(flattenHelpers)) {
      attachFlattenHelpers(response$$, flattenHelpers);
      methodsToKeep.push(flattenHelpers[0], flattenHelpers[1]);
    }

    if (selectorMethod && selectorProp && requestProp) {
      attachSelectorHelper(response$$, { selectorMethod: selectorMethod, requestProp: requestProp, selectorProp: selectorProp });
      methodsToKeep.push(selectorMethod);
    }

    return methodsToKeep.length ? (0, _proxyMethods.proxyAndKeepMethods)(response$$, methodsToKeep) : response$$;
  };
};

exports.createDriver = makeAsyncDriver;
exports.default = makeAsyncDriver;