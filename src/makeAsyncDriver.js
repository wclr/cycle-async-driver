import makeDriverSource from './makeDriverSource'
import getResponsePromise from './getResponsePromise'

const isFunction = (f) => typeof f === 'function'

const makeAsyncDriver = (options) => {
  let {
    getResponse,
    getProgressiveResponse,
    requestProp = 'request',
    normalizeRequest = null,
    isolate = true,
    isolateProp = '_namespace',
    isolateNormalize = null,
    selectHelperName = 'select',
    selectDefaultProp = 'category',
    lazy = false
    } = options

  if (normalizeRequest && !isFunction(normalizeRequest)) {
    throw new Error(`'normalize' option should be a function.`)
  }
  if (normalizeRequest && !isolateNormalize){
    isolateNormalize = normalizeRequest
  }
  if (isFunction(options)) {
    getResponse = options
  }
  if (!isFunction(getResponse) && !isFunction(getProgressiveResponse)) {
    throw new Error(`'getResponse' param is method is required.`)
  }

  return (request$, runStreamAdapter) => {
    if (!runStreamAdapter){
      throw new Error(`Stream adapter is required as second parameter`)
    }
    const empty = () => {}
    const emptySubscribe = (stream) =>
      runStreamAdapter.streamSubscribe((stream), {
        next: empty,
        error: empty,
        complete: empty
      })

    const {observer, stream} = runStreamAdapter.makeSubject()
    const response$$ = runStreamAdapter.remember(stream)
    emptySubscribe(response$$)

    runStreamAdapter.streamSubscribe(request$, {
      next: (request => {
        const requestNormalized = normalizeRequest
          ? normalizeRequest(request)
          : request
        let response$
        let isLazyRequest = typeof requestNormalized.lazy === 'boolean'
          ? requestNormalized.lazy : lazy
        response$ = runStreamAdapter.adapt({}, (_, observer) => {
          let dispose
          const disposeCallback = (_) => dispose = _
          if (getProgressiveResponse) {
            getProgressiveResponse(
              requestNormalized, observer, disposeCallback
            )
          } else {
            let promise = getResponsePromise(
              getResponse, requestNormalized, disposeCallback
            )
            promise.then((result) => {
              observer.next(result)
              observer.complete()
            }, observer.error)
          }
          return () => {
            isFunction(dispose) && dispose()
          }
        })
        if (!isLazyRequest){
          response$ = runStreamAdapter.remember(response$)
          emptySubscribe(response$)
        }
        if (requestProp){
          Object.defineProperty(response$, requestProp, {
            value: requestNormalized,
            writable: false
          })
        }
        observer.next(response$)
      }),
      error: observer.error,
      complete: observer.complete
    })

    return makeDriverSource(response$$, {
      runStreamAdapter,
      selectHelperName,
      selectDefaultProp,
      requestProp,
      isolate,
      isolateProp,
      isolateNormalize
    })
  }
}

export default makeAsyncDriver
