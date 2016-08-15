'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _makeDriverSource = require('./makeDriverSource');

var _makeDriverSource2 = _interopRequireDefault(_makeDriverSource);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isFunction = function isFunction(f) {
  return typeof f === 'function';
};

var makeAsyncDriver = function makeAsyncDriver(options) {
  var getResponse = options.getResponse;
  var getProgressiveResponse = options.getProgressiveResponse;
  var _options$requestProp = options.requestProp;
  var requestProp = _options$requestProp === undefined ? 'request' : _options$requestProp;
  var _options$normalizeReq = options.normalizeRequest;
  var normalizeRequest = _options$normalizeReq === undefined ? null : _options$normalizeReq;
  var _options$isolate = options.isolate;
  var isolate = _options$isolate === undefined ? true : _options$isolate;
  var _options$isolateProp = options.isolateProp;
  var isolateProp = _options$isolateProp === undefined ? '_namespace' : _options$isolateProp;
  var _options$isolateNorma = options.isolateNormalize;
  var isolateNormalize = _options$isolateNorma === undefined ? null : _options$isolateNorma;
  var _options$selectHelper = options.selectHelperName;
  var selectHelperName = _options$selectHelper === undefined ? 'select' : _options$selectHelper;
  var _options$selectDefaul = options.selectDefaultProp;
  var selectDefaultProp = _options$selectDefaul === undefined ? 'category' : _options$selectDefaul;
  var _options$lazy = options.lazy;
  var lazy = _options$lazy === undefined ? false : _options$lazy;


  if (normalizeRequest && !isFunction(normalizeRequest)) {
    throw new Error('\'normalize\' option should be a function.');
  }
  if (normalizeRequest && !isolateNormalize) {
    isolateNormalize = normalizeRequest;
  }
  if (isFunction(options)) {
    getResponse = options;
  }
  if (!isFunction(getResponse) && !isFunction(getProgressiveResponse)) {
    throw new Error('\'getResponse\' param is method is required.');
  }

  return function (request$, runStreamAdapter) {
    if (!runStreamAdapter) {
      throw new Error('Stream adapter is required as second parameter');
    }
    var empty = function empty() {};
    var emptySubscribe = function emptySubscribe(stream) {
      return runStreamAdapter.streamSubscribe(stream, {
        next: empty,
        error: empty,
        complete: empty
      });
    };

    var response$$ = runStreamAdapter.adapt({}, function (_, observer) {
      runStreamAdapter.streamSubscribe(request$, {
        next: function next(request) {
          var requestNormalized = normalizeRequest ? normalizeRequest(request) : request;
          var isLazyRequest = typeof requestNormalized.lazy === 'boolean' ? requestNormalized.lazy : lazy;
          var response$ = runStreamAdapter.adapt({}, function (_, observer) {
            var dispose = void 0;
            var disposeCallback = function disposeCallback(_) {
              return dispose = _;
            };
            if (getProgressiveResponse) {
              var contextFreeObserver = {
                next: observer.next.bind(observer),
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer)
              };
              getProgressiveResponse(requestNormalized, contextFreeObserver, disposeCallback);
            } else {
              (function () {
                var callback = function callback(err, result) {
                  if (err) {
                    observer.error(err);
                  } else {
                    observer.next(result);
                    observer.complete();
                  }
                };
                var res = getResponse(request, callback, disposeCallback);
                if (res && isFunction(res.then)) {
                  res.then(function (result) {
                    return callback(null, result);
                  }, callback);
                }
              })();
            }
            return function () {
              isFunction(dispose) && dispose();
            };
          });
          if (!isLazyRequest) {
            response$ = runStreamAdapter.remember(response$);
            emptySubscribe(response$);
          }
          if (requestProp) {
            Object.defineProperty(response$, requestProp, {
              value: requestNormalized,
              writable: false
            });
          }
          observer.next(response$);
        },
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer)
      });
    });
    response$$ = runStreamAdapter.remember(response$$);
    emptySubscribe(response$$);

    return (0, _makeDriverSource2.default)(response$$, {
      runStreamAdapter: runStreamAdapter,
      selectHelperName: selectHelperName,
      selectDefaultProp: selectDefaultProp,
      requestProp: requestProp,
      isolate: isolate,
      isolateProp: isolateProp,
      isolateNormalize: isolateNormalize
    });
  };
};

exports.default = makeAsyncDriver;