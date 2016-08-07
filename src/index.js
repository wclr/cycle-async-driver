import {Observable as O, Subject} from 'rx'
import {proxyAndKeepMethods} from './proxyMethods'

import {isObservable, isPromise} from './util'

const defaultRequestProp = 'request'
const defaultSelectorMethod = 'select'
const defaultSelectorProp = 'category'
const defaultFlattenHelpers = ['success', 'failure']
const defaultFlattenAllHelpers = ['successAll', 'failureAll']
const defaultPullHelperName = 'pull'

const flattenSuccess = (r$, selector, requestProp) =>
  (selector ? r$.map((r) => selector(r, r$[requestProp])) : r$)
    .catch(O.empty())

const flattenFailure = (r$, selector, requestProp) =>
  r$.skip().catch(e => O.of(selector ? selector(e, r$[requestProp]) : e))

const makeFlattenHelper = (flattenFn, latest) => {
  return function fn (...args) {
    if (args[0] && isObservable(args[0])) {
      let r$$ = args.shift()
      return fn.apply(null, args)(r$$)
    }
    var flatMethod = latest ? 'flatMapLatest' : 'flatMap'
    let [selector, requestProp = defaultRequestProp] = args
    return function (r$$) {
      return r$$[flatMethod](r$ => flattenFn(r$, selector, requestProp))
    }
  }
}

export const success = makeFlattenHelper(flattenSuccess, true)
export const failure = makeFlattenHelper(flattenFailure, true)

export const successAll = makeFlattenHelper(flattenSuccess)
export const failureAll = makeFlattenHelper(flattenFailure)

const makeSelectHelper = ({
  selectorProp = defaultSelectorProp,
  requestProp = defaultRequestProp
} = {}) => {
  return function (property, match) {
    if (arguments.length === 1) {
      match = property
      property = selectorProp
    }
    if (!match){
      return this
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

export const attachFlattenHelpers = (r$$, flattenHelpers = defaultFlattenHelpers, requestProp) => {
  r$$[flattenHelpers[0]] = function(selector) {
    return success(this, selector, requestProp)
  }
  r$$[flattenHelpers[1]] = function (selector) {
    return failure(this, selector, requestProp)
  }
  return r$$
}

export const attachFlattenAllHelpers = (r$$, flattenAllHelpers = defaultFlattenAllHelpers, requestProp) => {
  r$$[flattenAllHelpers[0]] = function(selector) {
    return successAll(this, selector, requestProp)
  }
  r$$[flattenAllHelpers[1]] = function (selector) {
    return failureAll(this, selector, requestProp)
  }
  return r$$
}


export const attachSelectorHelper = 
  (r$$, {
    selectorMethod = defaultSelectorMethod,
    selectorProp = defaultSelectorProp,
    requestProp
  } = {}) => {
    r$$[selectorMethod] = makeSelectHelper({selectorProp, requestProp})
    return r$$
  }

import {attachPull} from './attachPull'
import {attachPullDriver} from './attachPullDriver'

export const attachHelpers = (driver, options = {}) => {
  let {
    pullHelper = defaultPullHelperName,
    usePullDriver = true,
    pullScopePrefix
    } = options

  if (typeof driver === 'function'){
    return function () {
      let driverWithHelpers = function () {
        return attachHelpers(driver.apply(null, arguments), options)
      }
      if (pullHelper){
        const attachPullFn = usePullDriver ? attachPullDriver : attachPull
        driverWithHelpers = attachPullFn(driverWithHelpers, pullHelper, pullScopePrefix)
      }
      return driverWithHelpers.apply(null, arguments)
    }
  }
  const response$$ = driver
  let {
    flatten = defaultFlattenHelpers,
    flattenAll = defaultFlattenAllHelpers,
    selectorMethod = defaultSelectorMethod,
    selectorProp = defaultSelectorProp,
    keepMethods = [],
    requestProp = defaultRequestProp} = options

  if (flatten){
    attachFlattenHelpers(response$$, flatten, requestProp)
  }
  if (flattenAll){
    attachFlattenAllHelpers(response$$, flattenAll, requestProp)
  }
  if (selectorMethod && selectorProp && requestProp){
    attachSelectorHelper(response$$, {
      selectorMethod,
      selectorProp,
      requestProp
    })
  }
  if (keepMethods){
    let methodsToKeep = [
      'isolateSink',
      'isolateSource'
    ].concat(selectorMethod || [])
      .concat(flatten || [])
      .concat(flattenAll || [])
      .concat(pullHelper || [])
      .concat(keepMethods)
    return proxyAndKeepMethods(response$$, methodsToKeep)
  }
  return response$$
}

export {proxyAndKeepMethods}

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
    requestProp = defaultRequestProp,
    responseProp = false,
    normalizeRequest = _ => _,
    eager = true,
    isolate = true,
    isolateProp = '_namespace',
    isolateMap = null,
    isolateSink,
    isolateSource,
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

  let driver = (request$) => {
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

    var methodsToKeep = ['dispose']

    if (isolate){
      response$$.isolateSource = isolateSource || _isolateSource
      response$$.isolateSink = isolateSink || _isolateSink
      methodsToKeep.push('isolateSink', 'isolateSource')
    }

    return response$$
  }

  return attachHelpers(driver, options)
}

export {makeAsyncDriver as createDriver}
export default makeAsyncDriver
