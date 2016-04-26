import {Observable as O} from 'rx'
import {proxyAndKeepMethods} from './proxy-methods'
// not using `instanceOf` because for linked npm modules
// `Observable` and `Promise` will be different
export const isObservable = (response$) =>
  typeof response$.subscribe === 'function'

export const isPromise = (response$) =>
  typeof response$.then === 'function'

export {proxyAndKeepMethods}

export const successful = (r$$, selector) => {
  return r$$.flatMap(r$ =>
    (selector ? r$.map(selector) : r$)
      .catch(O.empty())
  )
}

export const failed = (r$$, selector) => {
  return r$$.flatMap(r$ =>
    r$.skip().catch(e => O.of(selector ? selector(e) : e))
  )
}

export const attachFlattenHelpers = (r$$, flattenHelpers = ['successful', 'failed']) => {
  r$$[flattenHelpers[0]] = function(selector) {
    return successful(this, selector)
  }
  r$$[flattenHelpers[1]] = function (selector) {
    return failed(this, selector)
  }
}

export const attachSelectorHelper = 
  (r$$, {
    selectorMethod = 'select',
    selectorProp = 'category',
    requestProp = 'request'
  }) => {
    r$$[selectorMethod] = function (match) {
      let test = (match instanceof RegExp)
        ? ::match.test : (_) => match === _
      return this.filter(
        r$ => test(r$[requestProp][selectorProp])
      )
    }
    return r$$
  }

export const attachHelpers = (r$$, {flatten = true, selector = true, keepMethods = true} = {}) => {
  flatten && attachFlattenHelpers(r$$)
  selector && attachSelectorHelper(r$$)
  if (keepMethods){
    return proxyAndKeepMethods(r$$, [
      'isolateSink',
      'isolateSource',
      'select',
      'successful',
      'failed'
    ])
  }
  return r$$
}

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
    isolateSource,
    selectorMethod = 'select',
    selectorProp = 'category',
    flattenHelpers = ['successful', 'failed']
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
    //isolatedResponse$$.isolateSource = _isolateSource
    //isolatedResponse$$.isolateSink = _isolateSink
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
          [requestProp]: reqOptions
        })).catch((error) => {
              throw {
              error,
              [requestProp]: reqOptions
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

    var methodsToKeep = []

    if (isolate){
      response$$.isolateSource = isolateSource || _isolateSource
      response$$.isolateSink = isolateSink || _isolateSink
      methodsToKeep.push('isolateSink', 'isolateSource')
    }

    if (Array.isArray(flattenHelpers)){
      attachFlattenHelpers(response$$, flattenHelpers)
      methodsToKeep.push(flattenHelpers[0], flattenHelpers[1])
    }
    
    if (selectorMethod && selectorProp && requestProp){
      attachSelectorHelper(response$$, {selectorMethod, requestProp, selectorProp})
      methodsToKeep.push(selectorMethod)
    }
    
    return methodsToKeep.length
      ? proxyAndKeepMethods(response$$, methodsToKeep)
      : response$$
  }
}

export {makeAsyncDriver as createDriver}
export default makeAsyncDriver
