'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var makeFilter = function makeFilter(streamAdapter) {
  return function (stream, predicate) {
    return streamAdapter.adapt({}, function (_, observer) {
      return streamAdapter.streamSubscribe(stream, {
        next: function next(r$) {
          if (predicate(r$)) {
            observer.next(r$);
          }
        },
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer)
      });
    });
  };
};

var makeDriverSource = function makeDriverSource(response$$, options) {
  var runStreamAdapter = options.runStreamAdapter;
  var selectHelperName = options.selectHelperName;
  var selectDefaultProp = options.selectDefaultProp;
  var requestProp = options.requestProp;
  var isolate = options.isolate;
  var isolateProp = options.isolateProp;
  var isolateNormalize = options.isolateNormalize;


  var filterStream = makeFilter(runStreamAdapter);

  var driverSource = {
    filter: function filter(predicate) {
      var filteredResponse$$ = filterStream(response$$, predicate);
      return makeDriverSource(filteredResponse$$, options);
    }
  };

  if (isolate) {
    driverSource.isolateSink = function (request$, scope) {
      return request$.map(function (req) {
        req = isolateNormalize ? isolateNormalize(req) : req;
        req[isolateProp] = req[isolateProp] || [];
        req[isolateProp].push(scope);
        return req;
      });
    };
    driverSource.isolateSource = function (source, scope) {
      var requestPredicate = function requestPredicate(req) {
        return Array.isArray(req[isolateProp]) && req[isolateProp].indexOf(scope) !== -1;
      };
      return source.filter(function (r$) {
        return requestPredicate(r$[requestProp]);
      });
    };
  }
  if (selectHelperName) {
    driverSource[selectHelperName] = function (selectBy) {
      if (!selectBy) {
        return response$$;
      }
      var requestPredicate = typeof selectBy === 'string' ? function (req) {
        return req && req[selectDefaultProp] === selectBy;
      } : selectBy;
      return response$$.filter(function (r$) {
        return requestPredicate(r$[requestProp]);
      });
    };
  }
  return driverSource;
};

exports.default = makeDriverSource;