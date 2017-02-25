import makeDriverSource from './makeDriverSource'
const isFunction = (f) => typeof f === 'function'

const makeAsyncDriver = (options) => {
  let {
    getResponse,
    getProgressiveResponse,
    requestProp = 'request',
    normalizeRequest,
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

    let response$$ = runStreamAdapter.adapt({}, (_, observer) => {
      runStreamAdapter.streamSubscribe(request$, {
        next: (request) => {
          const requestNormalized = normalizeRequest
            ? normalizeRequest(request)
            : request
          let isLazyRequest = typeof requestNormalized.lazy === 'boolean'
            ? requestNormalized.lazy : lazy
          let response$ = runStreamAdapter.adapt({}, (_, observer) => {
            let dispose
            const disposeCallback = (_) => dispose = _
            if (getProgressiveResponse) {
              const contextFreeObserver = {
                next: observer.next.bind(observer),
                error: observer.error.bind(observer),
                complete: observer.complete.bind(observer)
              }
              getProgressiveResponse(
                requestNormalized, contextFreeObserver, disposeCallback
              )
            } else {
              const callback = (err, result) => {
                if (err){
                  observer.error(err)
                } else {
                  observer.next(result)
                  observer.complete()
                }
              }
              let res = getResponse(request, callback, disposeCallback)
              if (res && isFunction(res.then)){
                res.then((result) => callback(null, result)).catch(callback)
              }
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
        },
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer)
      })
    })
    response$$ = runStreamAdapter.remember(response$$)
    emptySubscribe(response$$)

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
