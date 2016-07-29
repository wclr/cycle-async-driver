export const saFilter = (streamAdapter, stream, predicate) => {
  return streamAdapter.adapt({}, (_, observer) => {
    return streamAdapter.streamSubscribe(stream, {
      next: (r$) => {
        if (predicate(r$)){
          observer.next(r$)
        }
      },
      error: observer.error,
      complete: observer.complete
    })
  })
}

export const saFlatten = (streamAdapter, response$$, options, mergeAll = false) => {
  let {next, error, requestProp} = options
  const empty = () => {}
  return streamAdapter.adapt({}, (_, observer) => {
    let lastResponse$
    let isLast = !mergeAll
      ? (r$) => lastResponse$ === r$
      : () => true
    streamAdapter.streamSubscribe(response$$, {
      next: (response$) => {
        lastResponse$ = response$
        const request = response$[requestProp]

        const senNext = (fn, response$) =>
          (res) => isLast(response$) && observer.next(fn(res, request))
        // TODO: sendNext on complete (progressive)
        streamAdapter.streamSubscribe(response$, {
          next: next ? senNext(next, response$)  : empty,
          error: error ? senNext(error, response$) : empty,
          complete: empty
        })
      },
      error: empty,
      complete: empty
    })
  })
}

export const saFlattenAll = (...args) => {
  return saFlatten(...args.concat(true))
}