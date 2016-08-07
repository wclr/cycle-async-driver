'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createDriver = exports.makeAsyncDriver = exports.proxyAndKeepMethods = exports.attachHelpers = exports.attachSelectorHelper = exports.attachFlattenAllHelpers = exports.attachFlattenHelpers = exports.select = exports.failureAll = exports.successAll = exports.failure = exports.success = undefined;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _rx = require('rx');

var _proxyMethods = require('./proxyMethods');

var _util = require('./util');

var _attachPull = require('./attachPull');

var _attachPullDriver = require('./attachPullDriver');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var defaultRequestProp = 'request';
var defaultSelectorMethod = 'select';
var defaultSelectorProp = 'category';
var defaultFlattenHelpers = ['success', 'failure'];
var defaultFlattenAllHelpers = ['successAll', 'failureAll'];
var defaultPullHelperName = 'pull';

var flattenSuccess = function flattenSuccess(r$, selector, requestProp) {
  return (selector ? r$.map(function (r) {
    return selector(r, r$[requestProp]);
  }) : r$).catch(_rx.Observable.empty());
};

var flattenFailure = function flattenFailure(r$, selector, requestProp) {
  return r$.skip().catch(function (e) {
    return _rx.Observable.of(selector ? selector(e, r$[requestProp]) : e);
  });
};

var makeFlattenHelper = function makeFlattenHelper(flattenFn, latest) {
  return function fn() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    if (args[0] && (0, _util.isObservable)(args[0])) {
      var r$$ = args.shift();
      return fn.apply(null, args)(r$$);
    }
    var flatMethod = latest ? 'flatMapLatest' : 'flatMap';
    var selector = args[0];
    var _args$ = args[1];
    var requestProp = _args$ === undefined ? defaultRequestProp : _args$;

    return function (r$$) {
      return r$$[flatMethod](function (r$) {
        return flattenFn(r$, selector, requestProp);
      });
    };
  };
};

var success = exports.success = makeFlattenHelper(flattenSuccess, true);
var failure = exports.failure = makeFlattenHelper(flattenFailure, true);

var successAll = exports.successAll = makeFlattenHelper(flattenSuccess);
var failureAll = exports.failureAll = makeFlattenHelper(flattenFailure);

var makeSelectHelper = function makeSelectHelper() {
  var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var _ref$selectorProp = _ref.selectorProp;
  var selectorProp = _ref$selectorProp === undefined ? defaultSelectorProp : _ref$selectorProp;
  var _ref$requestProp = _ref.requestProp;
  var requestProp = _ref$requestProp === undefined ? defaultRequestProp : _ref$requestProp;

  return function (property, match) {
    var _this = this;

    if (arguments.length === 1) {
      match = property;
      property = selectorProp;
    }
    if (!match) {
      return this;
    }
    var makeTestSimple = function makeTestSimple(match) {
      return match instanceof RegExp ? match.test.bind(match) : typeof match === 'function' ? match : function (_) {
        return match === _;
      };
    };
    if (match.constructor === Object) {
      var _ret = function () {
        var props = Object.keys(match);
        return {
          v: _this.filter(function (r$) {
            return !props.reduce(function (matched, prop) {
              return matched || !makeTestSimple(match[prop])(r$[requestProp][prop]);
            }, false);
          })
        };
      }();

      if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
    } else {
      var _ret2 = function () {
        var testSimple = makeTestSimple(match);
        return {
          v: _this.filter(function (r$) {
            return testSimple(r$[requestProp][property]);
          })
        };
      }();

      if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
    }
  };
};

var select = exports.select = function select() {
  for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    args[_key2] = arguments[_key2];
  }

  if (args[0] && (0, _util.isObservable)(args[0])) {
    var r$$ = args.shift();
    return select.apply(null, args)(r$$);
  }
  var helper = makeSelectHelper();
  return function (r$$) {
    return helper.apply(r$$, args);
  };
};

var attachFlattenHelpers = exports.attachFlattenHelpers = function attachFlattenHelpers(r$$) {
  var flattenHelpers = arguments.length <= 1 || arguments[1] === undefined ? defaultFlattenHelpers : arguments[1];
  var requestProp = arguments[2];

  r$$[flattenHelpers[0]] = function (selector) {
    return success(this, selector, requestProp);
  };
  r$$[flattenHelpers[1]] = function (selector) {
    return failure(this, selector, requestProp);
  };
  return r$$;
};

var attachFlattenAllHelpers = exports.attachFlattenAllHelpers = function attachFlattenAllHelpers(r$$) {
  var flattenAllHelpers = arguments.length <= 1 || arguments[1] === undefined ? defaultFlattenAllHelpers : arguments[1];
  var requestProp = arguments[2];

  r$$[flattenAllHelpers[0]] = function (selector) {
    return successAll(this, selector, requestProp);
  };
  r$$[flattenAllHelpers[1]] = function (selector) {
    return failureAll(this, selector, requestProp);
  };
  return r$$;
};

var attachSelectorHelper = exports.attachSelectorHelper = function attachSelectorHelper(r$$) {
  var _ref2 = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var _ref2$selectorMethod = _ref2.selectorMethod;
  var selectorMethod = _ref2$selectorMethod === undefined ? defaultSelectorMethod : _ref2$selectorMethod;
  var _ref2$selectorProp = _ref2.selectorProp;
  var selectorProp = _ref2$selectorProp === undefined ? defaultSelectorProp : _ref2$selectorProp;
  var requestProp = _ref2.requestProp;

  r$$[selectorMethod] = makeSelectHelper({ selectorProp: selectorProp, requestProp: requestProp });
  return r$$;
};

var attachHelpers = exports.attachHelpers = function attachHelpers(driver) {
  var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
  var _options$pullHelper = options.pullHelper;
  var pullHelper = _options$pullHelper === undefined ? defaultPullHelperName : _options$pullHelper;
  var _options$usePullDrive = options.usePullDriver;
  var usePullDriver = _options$usePullDrive === undefined ? true : _options$usePullDrive;
  var pullScopePrefix = options.pullScopePrefix;


  if (typeof driver === 'function') {
    return function () {
      var driverWithHelpers = function driverWithHelpers() {
        return attachHelpers(driver.apply(null, arguments), options);
      };
      if (pullHelper) {
        var attachPullFn = usePullDriver ? _attachPullDriver.attachPullDriver : _attachPull.attachPull;
        driverWithHelpers = attachPullFn(driverWithHelpers, pullHelper, pullScopePrefix);
      }
      return driverWithHelpers.apply(null, arguments);
    };
  }
  var response$$ = driver;
  var _options$flatten = options.flatten;
  var flatten = _options$flatten === undefined ? defaultFlattenHelpers : _options$flatten;
  var _options$flattenAll = options.flattenAll;
  var flattenAll = _options$flattenAll === undefined ? defaultFlattenAllHelpers : _options$flattenAll;
  var _options$selectorMeth = options.selectorMethod;
  var selectorMethod = _options$selectorMeth === undefined ? defaultSelectorMethod : _options$selectorMeth;
  var _options$selectorProp = options.selectorProp;
  var selectorProp = _options$selectorProp === undefined ? defaultSelectorProp : _options$selectorProp;
  var _options$keepMethods = options.keepMethods;
  var keepMethods = _options$keepMethods === undefined ? [] : _options$keepMethods;
  var _options$requestProp = options.requestProp;
  var requestProp = _options$requestProp === undefined ? defaultRequestProp : _options$requestProp;


  if (flatten) {
    attachFlattenHelpers(response$$, flatten, requestProp);
  }
  if (flattenAll) {
    attachFlattenAllHelpers(response$$, flattenAll, requestProp);
  }
  if (selectorMethod && selectorProp && requestProp) {
    attachSelectorHelper(response$$, {
      selectorMethod: selectorMethod,
      selectorProp: selectorProp,
      requestProp: requestProp
    });
  }
  if (keepMethods) {
    var methodsToKeep = ['isolateSink', 'isolateSource'].concat(selectorMethod || []).concat(flatten || []).concat(flattenAll || []).concat(pullHelper || []).concat(keepMethods);
    return (0, _proxyMethods.proxyAndKeepMethods)(response$$, methodsToKeep);
  }
  return response$$;
};

exports.proxyAndKeepMethods = _proxyMethods.proxyAndKeepMethods;


var createResponse$FromGetResponse = function createResponse$FromGetResponse(getResponse, reqOptions) {
  var p = void 0;
  var promise = new Promise(function (resolve, reject) {
    p = { resolve: resolve, reject: reject };
  });
  var callback = function callback(err, result) {
    err ? p.reject(err) : p.resolve(result);
  };
  var response$ = getResponse(reqOptions, callback);
  if (!response$ || !(0, _util.isObservable)(response$)) {
    if (response$ && (0, _util.isPromise)(response$)) {
      promise = response$;
    }
    response$ = _rx.Observable.fromPromise(promise);
  }
  return response$;
};

var makeAsyncDriver = exports.makeAsyncDriver = function makeAsyncDriver(options) {
  var createResponse$ = options.createResponse$;
  var getResponse = options.getResponse;
  var _options$requestProp2 = options.requestProp;
  var requestProp = _options$requestProp2 === undefined ? defaultRequestProp : _options$requestProp2;
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
    //isolatedResponse$$.isolateSource = _isolateSource
    //isolatedResponse$$.isolateSink = _isolateSink
    return isolatedResponse$$;
  }

  var driver = function driver(request$) {
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

    var methodsToKeep = ['dispose'];

    if (isolate) {
      response$$.isolateSource = isolateSource || _isolateSource;
      response$$.isolateSink = isolateSink || _isolateSink;
      methodsToKeep.push('isolateSink', 'isolateSource');
    }

    return response$$;
  };

  return attachHelpers(driver, options);
};

exports.createDriver = makeAsyncDriver;
exports.default = makeAsyncDriver;