import {Observable as O} from 'rx'
import {proxyAndKeepMethods} from './proxy-methods'

export const isObservable = (response$) =>
  typeof response$.subscribe === 'function'

export const isPromise = (response$) =>
  typeof response$.then === 'function'

export {proxyAndKeepMethods}

const flattenSuccessful = (r$, selector, requestProp) =>
  (selector ? r$.map((r) => selector(r, r$[requestProp])) : r$)
    .catch(O.empty())

const flattenFailed = (r$, selector, requestProp) =>
  r$.skip().catch(e => O.of(selector ? selector(e, r$[requestProp]) : e))

const makeFlattenHelper = (flattenFn) => {
  return function fn (...args) {
    if (args[0] && isObservable(args[0])){
      let r$$ = args.shift()
      return fn.apply(null, args)(r$$)
    }
    let [selector, requestProp = 'request'] = args
    return function (r$$) {
      return r$$.flatMap(r$ => flattenFn(r$, selector, requestProp))
    }
  }
}

export const successful = makeFlattenHelper(flattenSuccessful)
export const failed = makeFlattenHelper(flattenFailed)

const makeSelectHelper = ({
  selectorProp = 'category',
  requestProp = 'request'
} = {}) => {
  return function (property, match) {
    if (arguments.length === 1){
      match = property
      property = selectorProp
    }
    if (!match){
      throw new Error (`Selector helper should have \`match\` ` +
        `param which is string, regExp, or plain object with props.`)
    }
    let makeTestSimple = (match) =>
      (match instanceof RegExp)
        ? ::match.test
        : typeof match === 'function'
          ? match : (_) => match === _
    if (match.constructor === Object){
      let props = Object.keys(match)
      return this.filter(
        r$ => !props.reduce((matched, prop) =>
          matched || !makeTestSimple(match[prop])(r$[requestProp][prop])
          , false)
      )
    } else {
      let testSimple = makeTestSimple(match)
      return this.filter(
        r$ => testSimple(r$[requestProp][property])
      )
    }
  }
}

export const select = (...args) => {
  if (args[0] && isObservable(args[0])){
    let r$$ = args.shift()
    return select.apply(null, args)(r$$)
  }
  var helper = makeSelectHelper()
  return function (r$$) {
    return helper.apply(r$$, args)
  }
}

export const attachFlattenHelpers = (r$$, flattenHelpers = ['successful', 'failed'], requestProp) => {
  r$$[flattenHelpers[0]] = function(selector) {
    return successful(this, selector, requestProp)
  }
  r$$[flattenHelpers[1]] = function (selector, requestProp) {
    return failed(this, selector)
  }
  return r$$
}

export const attachSelectorHelper = 
  (r$$, {
    selectorMethod = 'select',
    selectorProp,
    requestProp
  } = {}) => {
    r$$[selectorMethod] = makeSelectHelper({selectorProp, requestProp})
    return r$$
  }

export const attachHelpers = (r$$, options = {}) => {
  if (typeof r$$ === 'function'){
    return function () {
      return attachHelpers(r$$.apply(r$$, arguments), options)
    } 
  }
  let {flatten = true, selector = true, keepMethods = true} = options 
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
      attachFlattenHelpers(response$$, flattenHelpers, requestProp)
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
