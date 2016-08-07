const isFunction = (f) => typeof f === 'function'

const makeStreamSource = (response$$, driverSource, options) => {
  let {selectHelperName} = options

  response$$.filter = (predicate) => {
    let filteredSource = driverSource.filter(predicate)
    return makeStreamSource(filteredSource._res$$, filteredSource, options)
  }

  if (isFunction(driverSource[selectHelperName])){
    response$$[selectHelperName] = (selectBy) =>
      driverSource[selectHelperName](selectBy)
  }

  if (isFunction(driverSource.isolateSource)){
    response$$.isolateSource = (...args) => {
      let isolatedSource = driverSource.isolateSource(args)
      return makeStreamSource(isolatedSource._res$$, isolatedSource, options)
    }
  }

  if (isFunction(driverSource.isolateSink)){
    response$$.isolateSink = (...args) => {
      return driverSource.isolateSink(args)
    }
  }
  return response$$
}

export default makeStreamSource