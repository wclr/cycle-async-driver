const makeFilter = (streamAdapter) =>
  (stream, predicate) =>
    streamAdapter.adapt({}, (_, observer) =>
      streamAdapter.streamSubscribe(stream, {
        next: (r$) => {
          if (predicate(r$)){
            observer.next(r$)
          }
        },
        error: ::observer.error,
        complete: ::observer.complete
      })
    )

const makeDriverSource = (response$$, options) => {
  let {
    runStreamAdapter,
    selectHelperName,
    selectDefaultProp,
    requestProp,
    isolate,
    isolateProp,
    isolateNormalize
    }  = options

  let filterStream = makeFilter(runStreamAdapter)

  let driverSource = {
    filter (predicate) {
      const filteredResponse$$ = filterStream(response$$, predicate)
      return makeDriverSource(filteredResponse$$, options)
    }
  }

  if (isolate){
    driverSource.isolateSink = (request$, scope) => {
      return request$.map(req => {
        req = isolateNormalize ? isolateNormalize(req) : req
        req[isolateProp] = req[isolateProp] || []
        req[isolateProp].push(scope)
        return req
      })
    }
    driverSource.isolateSource = (source, scope) => {
      let requestPredicate = (req) => {
        return Array.isArray(req[isolateProp]) &&
          req[isolateProp].indexOf(scope) !== -1
      }
      return source.filter(r$ => requestPredicate(r$[requestProp]))
    }
  }
  if (selectHelperName) {
    driverSource[selectHelperName] = (selectBy) => {
      if (!selectBy){
        return response$$
      }
      let requestPredicate = typeof selectBy === 'string'
        ? (req) => req && req[selectDefaultProp] === selectBy
        : selectBy
      return response$$.filter(r$ => requestPredicate(r$[requestProp]))
    }
  }
  return driverSource
}

export default makeDriverSource