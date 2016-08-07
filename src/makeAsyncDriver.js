import makeDriverSource from './makeDriverSource'
import makeStreamSource from './makeStreamSource'
import getResponsePromise from './getResponsePromise'

const isFunction = (f) => typeof f === 'function'

const makeAsyncDriver = (options) => {
  let {
    getResponse,
    getProgressiveResponse,
    requestProp = 'request',
    normalizeRequest = null,
    lazy = false,
    isolate = true,
    isolateProp = '_namespace',
    isolateNormalize = null,
    selectHelperName = 'select',
    selectDefaultProp = 'category',
    streamSource = false
    } = options

  if (normalizeRequest && !isFunction(normalizeRequest)){
    throw new Error(`'normalize' option should be a function.`)
  }
  if (normalizeRequest && !isolateNormalize){
    isolateNormalize = normalizeRequest
  }
  if (isFunction(options)){
    getResponse = options
  }
  if (!isFunction(getResponse) && !isFunction(getProgressiveResponse)) {
    throw new Error(`'getResponse' param is method is required.`)
  }

  return (request$, runStreamAdapter) => {
    if (!runStreamAdapter){
      throw new Error(`Stream adapter is required as second parameter`)
    }
    const subscribe = (stream) =>
      runStreamAdapter.streamSubscribe(stream, {
        next: () => {}, error: () => {}, complete: () => {}
      })

    const {observer, stream} = runStreamAdapter.makeSubject()
    const response$$ = runStreamAdapter.remember(stream)
    subscribe(response$$)

    runStreamAdapter.streamSubscribe(request$, {
      next: (request => {
        const reqOptions = normalizeRequest
          ? normalizeRequest(request)
          : request
        let response$
        let eagerPromise
        let isLazyRequest = typeof reqOptions.lazy === 'boolean'
          ? reqOptions.lazy : lazy

        response$ = runStreamAdapter.adapt({}, (_, observer) => {
          if (getProgressiveResponse) {
            getProgressiveResponse(reqOptions, observer)
          } else {
            let promise = eagerPromise || getResponsePromise(getResponse, reqOptions)
            promise.then((result) => {
              observer.next(result)
              observer.complete()
            }, observer.error)
          }
        })
        if (!isLazyRequest){
          response$ = runStreamAdapter.remember(response$)
          subscribe(response$)
        }
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

    const driverSource = makeDriverSource(response$$, {
      runStreamAdapter,
      selectHelperName,
      selectDefaultProp,
      requestProp,
      isolate,
      isolateProp,
      isolateNormalize
    })

    return streamSource
      ? makeStreamSource(response$$, driverSource, {selectHelperName})
      : driverSource
  }
}

export default makeAsyncDriver
