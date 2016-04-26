const arrayToMap = (array) =>
  array.reduce((map, item) => {
    map[item] = true
    return map
  }, {})

const methodsToProxy = [
  'filter', 'map', 'first', 'last', 'delay', 'throttle',
  'concat', 'sample', 'withLatestFrom', 'zip', 'combineLatest',
  'skip', 'skipLast', 'skipLastWithTime', 'skipUntil',
  'skipUntilWithTime', 'skipWhile', 'skipWithTime',
  'take', 'takeLast', 'takeLastWithTime', 'takeUntil',
  'takeUntilWithTime', 'takeWhile', 'takeWithTime'

]

export const proxyAndKeepMethods = (response$$, methodsToKeep) => {
  methodsToProxy.forEach(methodToProxy => {
      let _oldMethod = response$$[methodToProxy]
      response$$[methodToProxy] = function () {
        let result = _oldMethod.apply(response$$, arguments)
        proxyAndKeepMethods(result, methodsToKeep)
        methodsToKeep.forEach((methodToKeep) => {
          result[methodToKeep] = response$$[methodToKeep]
        })

        return result
      }
  })
  return response$$
}