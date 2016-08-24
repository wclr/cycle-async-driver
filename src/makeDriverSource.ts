const makeFilter = (streamAdapter) =>
  (stream, predicate) =>
    streamAdapter.adapt({}, (_, observer) =>
      streamAdapter.streamSubscribe(stream, {
        next: (r$) => {
          if (predicate(r$)) {
            observer.next(r$)
          }
        },
        error: observer.error.bind(observer),
        complete: observer.complete.bind(observer)
      })
    )

const makeDriverSource = (response$$, options) => {
  let {
    runStreamAdapter,
    selectHelperName,
    selectDefaultProp,
    requestProp,
    isolate,
    isolateProp,
    isolateNormalize
  } = options

  let filterStream = makeFilter(runStreamAdapter)

  let driverSource = {
    filter(predicate): any {
      const filteredResponse$$ = filterStream(
        response$$, (r$) => predicate(r$.request)
      )
      return makeDriverSource(filteredResponse$$, options)
    },
    isolateSink(request$, scope) {
      return request$.map(req => {
        req = isolateNormalize ? isolateNormalize(req) : req
        req[isolateProp] = req[isolateProp] || []
        req[isolateProp].push(scope)
        return req
      })
    },
    isolateSource: (source, scope) => {
      let requestPredicate = (req) => {
        return Array.isArray(req[isolateProp]) &&
          req[isolateProp].indexOf(scope) !== -1
      }

      return source.filter(requestPredicate)
    },
    select(category) {
      if (!category) {
        return response$$
      }
      if (typeof category !== 'string') {
        throw new Error(`category should be a string`)
      }
      let requestPredicate =
        (request) => request && request.category === category
      return driverSource.filter(requestPredicate).select()
    }
  }
  return driverSource
}

export default makeDriverSource