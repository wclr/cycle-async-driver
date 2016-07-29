import {Observable as O, Subject} from 'rx'
import {isPromise} from './util'
import defaults from './defaults'

import {saFilter, saFlatten, saFlattenAll} from './adapterHelpers'
import {
  attachIsolateHelpers,
  attachSelectHelper,
  attachFlattenHelpers
} from './helpers'


const isFunction = (f) => typeof f === 'function'

const getResponsePromise = (getResponse, request) => {
  let p
  let promise = new Promise((resolve, reject) => {
    p = {resolve, reject}
  })
  let callback = (err, result) => {
    err ? p.reject(err) : p.resolve(result)
  }
  let res = getResponse(request, callback)
  if (res && isPromise(res)) {
    promise = res
  }
  return promise
}

export const makeAsyncDriver = (options) => {
  let {
    getResponse,
    getProgressiveResponse,
    requestProp = 'request',
    responseProp = false,
    normalizeRequest = _ => _,
    eager = true,
    isolate = true,
    isolateProp = '_namespace',
    isolateNormalize = null,
    selectHelper = 'select',
    selectProp = 'category',
    flattenHelpers = ['success', 'failure'],
    flattenAllHelpers = ['successAll', 'failureAll'],
    sourceIsStream = true
  } = options

  if (responseProp === true){
    responseProp = 'response'
  }
  if (!isFunction(normalizeRequest)){
    throw new Error(`'normalize' option should be a function.`)
  }
  if (normalizeRequest && !isolateNormalize){
    isolateNormalize = normalizeRequest
  }
  if (isFunction(options)){
    getResponse = options
  }
  if (!isFunction(getResponse)) {
    throw new Error(`'getResponse' method is required.`)
  }

  const driver = (request$, runSA) => {
    const {observer, stream} = runSA.makeSubject()
    const response$$ = runSA.remember(stream)

    runSA.streamSubscribe(request$, {
      next: (request => {
        const reqOptions = normalizeRequest(request)
        let response$

        let eagerPromise
        if (typeof reqOptions.eager === 'boolean' ? reqOptions.eager : eager) {
          eagerPromise = getResponsePromise(getResponse, reqOptions)
        }

        const mapResponse = (res) =>
          responseProp ? {
              [responseProp]: res,
              [requestProp]: reqOptions
            } : res

        const mapError = (err) =>
          responseProp ? {
              error: err,
              [requestProp]: reqOptions
          } : err


        response$ = runSA.remember(runSA.adapt({}, (_, observer) => {
          let next = (res) => observer.next(mapResponse(res))
          let error = (err) => observer.error(mapError(err))
          let complete = (res) => {
            next(res)
            observer.complete()
          }
          if (getProgressiveResponse) {
            getProgressiveResponse(reqOptions, {
              next, error, complete
            })
            return
          }
          let promise = eagerPromise || getResponsePromise(getResponse, reqOptions)
          promise.then(complete, error)
        }))

        if (requestProp){
          Object.defineProperty(response$, requestProp, {
            value: reqOptions,
            writable: false
          })
        }
        observer.next(response$)
      }),
      error: observer.error,
      complete: observer.complete
    })

    attachIsolateHelpers(runSA, response$$, {
      isolateProp,
      isolateNormalize
    })
    attachSelectHelper(runSA, response$$, {
      selectHelper,
      selectProp,
      requestProp,
      isolateProp,
      isolateNormalize,
      flattenHelpers,
      flattenAllHelpers
    })
    attachFlattenHelpers(runSA, response$$, {
      requestProp,
      flattenHelpers,
      flattenAllHelpers
    })

    runSA.streamSubscribe(response$$, {
      next: () => {}, error: () => {}, complete: () => {}
    })

    return response$$
  }

  return driver
}

export default makeAsyncDriver
