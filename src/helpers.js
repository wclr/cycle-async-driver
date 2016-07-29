import {saFilter, saFlatten, saFlattenAll} from './adapterHelpers'

export const makeIsolateHelpers = (streamAdapter, options) => {
  let {isolateProp, isolateNormalize} = options
  return {
    isolateSink: (request$, scope) =>
      request$.map(req => {
        req = isolateNormalize ? isolateNormalize(req) : req
        req[isolateProp] = req[isolateProp] || []
        req[isolateProp].push(scope)
        return req
      }),
    isolateSource: (source, scope) =>
      source.select(req =>
        Array.isArray(req[isolateProp]) &&
        req[isolateProp].indexOf(scope) !== -1
      )

  }
}

const makeFlattenHelper = (streamAdapter, requestProp, failure = false, all = false) => {
  let nextOrError = failure ? 'error' : 'next'
  let flatten = all ? saFlattenAll : saFlatten
  return (response$$, selector) => {
    if (streamAdapter.isValidStream(response$$)){
      return flatten(streamAdapter, response$$, {[nextOrError]: selector, requestProp})
    } else {
      return function (response$$){
        if (!streamAdapter.isValidStream(response$$)){
          throw new Error (`You should provider a valid stream`)
        }
        return flatten(streamAdapter, response$$, {[nextOrError]: selector, requestProp})
      }
    }
  }
}

export const makeSuccessHelper = (streamAdapter, requestProp) =>
  makeFlattenHelper(streamAdapter, requestProp, false, false)

export const makeFailureHelper = (streamAdapter, requestProp) =>
  makeFlattenHelper(streamAdapter, requestProp, true, false)

export const makeSuccessAllHelper = (streamAdapter, requestProp) =>
  makeFlattenHelper(streamAdapter, requestProp, false, true)

export const makeFailureAllHelper = (streamAdapter, requestProp) =>
  makeFlattenHelper(streamAdapter, requestProp, true, true)

export const makeSelectHelper = (streamAdapter, options) => {
  let {
    requestProp,
    selectProp,
    flattenHelpers,
    flattenAllHelpers,
    } = options
  return (res$$, match) => {
    let filtered$ = saFilter(streamAdapter, res$$, (res$) => {
      let req = res$[requestProp]
      if (typeof match === 'function'){
        return match(req)
      } else if (typeof match === 'string') {
        return req[selectProp] === match
      } else {
        throw new Error(`selector method should have string or function type argument`)
      }
    })
    attachFlattenHelpers(streamAdapter, filtered$, options)
    attachIsolateHelpers(streamAdapter, filtered$, options)
    return filtered$
  }
}

export const attachFlattenHelpers = (streamAdapter, res$$, options) => {
  let {
    flattenHelpers,
    flattenAllHelpers,
    requestProp
    } = options
  const wrapHelper = (helper) =>
    (selector) => helper(res$$, selector)
  if (flattenHelpers){
    let [success, failure] = flattenHelpers
    res$$[success] = wrapHelper(makeSuccessHelper(streamAdapter, requestProp))
    res$$[failure] = wrapHelper(makeFailureHelper(streamAdapter, requestProp))
  }
  if (flattenAllHelpers){
    let [successAll, failureAll] = flattenAllHelpers
    res$$[successAll] = wrapHelper(makeSuccessAllHelper(streamAdapter, requestProp))
    res$$[failureAll] = wrapHelper(makeFailureAllHelper(streamAdapter, requestProp))
  }
  return res$$
}

export const attachIsolateHelpers = (streamAdapter, res$$, options) => {
  const isolateHelpers = makeIsolateHelpers(streamAdapter, options)
  res$$.isolateSource = isolateHelpers.isolateSource
  res$$.isolateSink = isolateHelpers.isolateSink
  return res$$
}

export const attachSelectHelper = (streamAdapter, res$$, options) => {
  let helper = makeSelectHelper(streamAdapter, options)
  res$$[options.selectHelper] = (match) => {
    return helper(res$$, match)
  }
  return res$$
}

let failure = (r$$) => r$$.map(r$ => r$.skip().catch(of))
let success = (r$$) => r$$.map(r$ => r$.catch(empty))

//let failure = (r$$) => r$$.catch(empty)