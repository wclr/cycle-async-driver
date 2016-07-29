import {Observable as O, Subject} from 'rx'
import {isObservable} from './util'

export const makeRequest$ = (request, sampler$) => {
  let request$
  if (!request){
    throw new Error(`valid request object or request$ stream should be provided`)
  }
  if (isObservable(request)) {
    request$ = request
  } else if (sampler$) {
    if (isObservable(sampler$)){
      request$ = sampler$.map(_ => request)
    } else {
      throw new Error(`sampler should be a stream`)
    }
  } else {
    request$ = O.just(request)
  }
  return request$
}

export const attachDispose = (response$$, subs) => {
  let _dispose = response$$.dispose
  response$$.dispose = function () {
    _dispose && _dispose.apply(response$$, arguments)
    subs.forEach(sub => sub.dispose())
  }
  return response$$
}

export const attachPull = (driver, helperName, scopePrefix = 'pull_scope_') =>
  (request$, runSA) => {
    let allRequests$ = new Subject()
    let scopeCounter = 0

    let response$$ = driver(allRequests$, runSA)
    let {isolateSink, isolateSource} = response$$
    const driverScope = scopePrefix + scopeCounter

    const subs = [
      isolateSink(request$, driverScope)
        .subscribe(::allRequests$.onNext)
    ]
    let driverResponse$$ = isolateSource(response$$, driverScope)

    driverResponse$$[helperName] = (request, sampler$) => {
      let request$ = makeRequest$(request, sampler$)
      const scope = scopePrefix + (++scopeCounter)
      subs.push(
        isolateSink(request$, scope)
          .subscribe(::allRequests$.onNext)
      )
      return isolateSource(response$$, scope)
    }
    return attachDispose(driverResponse$$, subs)
  }
