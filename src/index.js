export const createDriver = (options) => {
  let {
    createResponse$,
    requestProp = 'request',
    normalizeRequest = _ => _,
    eager = true,
    isolate = true,
    isolateProp = '_namespace',
    isolateMap = _ => _,
    isolateSink,
    isolateSource
  } = options

  if (typeof options == 'function'){
    createResponse$ = options
  } else if (!createResponse$) {
    throw new Error(`createResponse$ method should be provided.`)    
  }

  function _isolateSink(request$, scope) {
    return request$.map(req => {
      req = isolateMap(req)
      req[isolateProp] = req[isolateProp] || []
      req[isolateProp].push(scope)
      return req
    })
  }

  function _isolateSource(response$$, scope) {
    let isolatedResponse$$ = response$$.filter(res$ =>
      Array.isArray(res$[requestProp][isolateProp]) &&
      res$[requestProp][isolateProp].indexOf(scope) !== -1
    )
    isolatedResponse$$.isolateSource = _isolateSource
    isolatedResponse$$.isolateSink = _isolateSink
    return isolatedResponse$$
  }

  return function driver (request$) {
    let response$$ = request$
      .map(request => {
        const reqOptions = normalizeRequest(request)
        let response$ = createResponse$(reqOptions)
        if (typeof reqOptions.eager === 'boolean' ? reqOptions.eager : eager) {
          response$ = response$.replay(null, 1)
          response$.connect()
        }
        if (requestProp){
          Object.defineProperty(response$, requestProp, {
            value: reqOptions,
            writable: false
          })
        }
        return response$
      })
      .replay(null, 1)
    response$$.connect()
    if (isolate){
      response$$.isolateSource = isolateSource || _isolateSource
      response$$.isolateSink = isolateSink || _isolateSink
    }
    return response$$
  }
}