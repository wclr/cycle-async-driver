import {Observable as O} from 'rx'

// not using `instanceOf` because for linked npm modules
// `Observable` and `Promise` will be different
export const isObservable = (response$) =>
  typeof response$.subscribe === 'function'

export const isPromise = (response$) =>
  typeof response$.then === 'function'

const createResponse$FromGetResponse = (getResponse, reqOptions) => {
  let p
  let promise = new Promise((resolve, reject) => {
    p = {resolve, reject}
  })
  let callback = (err, result) => {
    err ? p.reject(err) : p.resolve(result)
  }
  let response$ = getResponse(reqOptions, callback)
  if (!response$ || !isObservable(response$)){
    if (response$ && isPromise(response$)) {
      promise = response$
    }
    response$ = O.fromPromise(promise)
  }
  return response$
}

export const makeAsyncDriver = (options) => {
  let {
    createResponse$,
    getResponse,
    requestProp = 'request',
    responseProp = false,
    normalizeRequest = _ => _,
    eager = true,
    isolate = true,
    isolateProp = '_namespace',
    isolateMap = null,
    isolateSink,
    isolateSource
  } = options

  if (responseProp === true){
    responseProp = 'response'
  }
  if (typeof normalizeRequest !== 'function'){
    throw new Error(`'normalize' option should be a function.`)
  }
  if (normalizeRequest && !isolateMap){
    isolateMap = normalizeRequest
  }

  if (typeof options == 'function'){
    getResponse = options
  } else if (!createResponse$ && !getResponse) {
    throw new Error(`'createResponse$' or 'getResponse' method should be provided.`)
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
        let response$
        if (createResponse$){
          response$ = createResponse$(reqOptions)
        } else {
          response$ = createResponse$FromGetResponse(getResponse, reqOptions)
        }

        response$ = responseProp ? response$
          .map(response => ({
          [responseProp]: response,
          [requestProp]: request
        })).catch((error) => {
              throw {
              error,
              [requestProp]: request
            }
          }) : response$

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

export {makeAsyncDriver as createDriver}
export default makeAsyncDriver

