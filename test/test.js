import xs from 'xstream'
import xsCycle from '@cycle/xstream-run'
import most from 'most'
import mostCycle from '@cycle/most-run'
import rxAdapter from '@cycle/rx-adapter'
import {makeAsyncDriver} from '../lib/index'
import {Observable as O, Subject} from 'rx'
import isolate from '@cycle/isolate'
import test from 'tape'

var basicDriver = makeAsyncDriver((request, _, setDispose) => {
  let completed = false
  setDispose(() => completed ? '' : request.aborted = true)
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      request.name
        ? resolve('async ' + request.name)
        : reject('async error')
      completed = true
    }, 10)
  })
})

var lazyDriver = makeAsyncDriver({
  getResponse: (request, callback) => {
    setTimeout(() =>
      callback(null, 'async ' + request.name + Math.random())
    )
  },
  lazy: true
})

var customDriver = makeAsyncDriver({
  requestProp: 'query',
  isolateProp: '_scope',
  isolateNormalize: (name) => ({name}),
  normalizeRequest: (request) => ({...request, normalized: true}),
  getResponse: (request, cb) => {
    cb(null, 'async ' + request.name)
  }
})

var progressiveDriver = makeAsyncDriver({
  getProgressiveResponse: (request, observer) => {
    setTimeout(() => {
      observer.next(1)
        setTimeout(() => {
          observer.next(2)
        })
        setTimeout(() => {
          observer.next(3)
          observer.complete()
        })
    })
  }
})

test('Basic driver from promise', (t) => {
  const request = {name: 'John'}
  const response = 'async John'
  const source = basicDriver(O.of(request), rxAdapter)

  source.select()
    .do(r$ => t.deepEqual(r$.request, request, 'response$.request is present and correct'))
    .mergeAll()
    .subscribe(x => {
      t.deepEqual(x, response, 'response')
      t.end()
    })
})

test('Basic driver - cancellation with abort (lazy requests)', (t) => {
  const requests = [
    {name: 'John', category: 'john', lazy: true},
    {name: 'Alex', type: 'alex', lazy: true}
  ]
  const response = 'async Alex'
  const source = basicDriver(O.fromArray(requests).delay(0), rxAdapter)

  source.select()
    .switch()
    .share()
    .subscribe(x => {
      t.ok(requests[0].aborted, 'fist request was aborted')
      t.deepEqual(x, response, 'response is correct')
      t.end()
    })
})

test('Basic driver - select method', (t) => {
  const requests = [
    {name: 'John', category: 'john'},
    {name: 'Alex', type: 'alex'}
  ]
  const responses = ['async John', 'async Alex']
  const source = basicDriver(O.fromArray(requests).delay(0), rxAdapter)

  source.select('john')
    .do(r$ => t.deepEqual(r$.request, requests[0], 'response$.request is present and correct'))
    .mergeAll()
    .subscribe(x => {
      t.deepEqual(x, responses[0], 'response 1 is correct')
    })

  source.select(r => r.type === 'alex')
    .do(r$ => t.deepEqual(r$.request, requests[1], 'response$.request is present and correct'))
    .mergeAll()
    .subscribe(x => {
      t.deepEqual(x, responses[1], 'response 2 is correct')
    })

  source.select().mergeAll()
    .bufferWithCount(2)
    .filter(x => x.length == 2)
    .subscribe(x => t.end())
})

test('Lazy driver (async callback)', (t) => {
  const request = {name: 'John'}
  //const response = 'async John'
  const source = lazyDriver(O.of(request), rxAdapter)
  let res1
  source.select()
    .mergeAll()
    .subscribe(x => {
      res1 = x
    })

  source.select()
    .mergeAll()
    .delay(100)
    .subscribe(res2 => {
      console.log('here',  res1, res2)
      t.notEqual(res1, res2, 'response are different')
      t.end()
    })
})

test('Basic driver - source filter method', (t) => {
  const requests = [
    {name: 'John', category: 'john'},
    {name: 'Alex', type: 'alex'}
  ]
  const responses = ['async John', 'async Alex']
  const source = basicDriver(O.fromArray(requests).delay(0), rxAdapter)

  source
    .filter(r$ => r$.request.category === 'john')
    .select()
    .do(r$ => t.deepEqual(r$.request, requests[0], 'response$.request is present and correct'))
    .mergeAll()
    .subscribe(x => {
      t.deepEqual(x, responses[0], 'response')
    })

  source.select()
    .mergeAll()
    .bufferWithCount(2)
    .filter(x => x.length === 2)
    .subscribe(x => {
      t.end()
    })
})

test('Basic driver isolation', (t) => {
  const request = {name: 'John'}
  const response = 'async John'

  const expected = {name: 'asyncJohn'}

  const dataflow = ({source}) => {
    source.select()
      .do(r$ => {
        t.same(r$.request.name, 'John', 'request is correct')
        t.same(r$.request._namespace, ['scope0'], 'request _namespace is correct')
      })
      .mergeAll()
      .subscribe(x => {
        t.deepEqual(x, response, 'response')
        t.end()
      })
    return {
      source: O.of(request)
    }
  }
  const request$ = new Subject()
  const source = basicDriver(request$, rxAdapter)
  isolate(dataflow, 'scope0')({source}).source.subscribe((request) => {
    request$.onNext(request)
  })
  request$.onNext({name: 'Alex', _namespace: ['scope1']})
})

test('Basic driver from promise failure', (t) => {
  const request = {name: ''}
  const source = basicDriver(O.of(request), rxAdapter)
  const expected = {name: 'asyncJohn'}

  source.select()
    .map(r$ => r$.catch(O.of('error')))
    .mergeAll()
    .subscribe(x => {
      t.deepEqual(x, 'error', 'error sent')
      t.end()
    })
})

test('Custom source driver with isolation, normalization and sync callback', (t) => {
  const request = 'John'
  const response = 'async John'

  const expected = {name: 'asyncJohn'}

  const dataflow = ({source}) => {
    source.select()
      .do(({query}) => {
        t.same(query.name, 'John', 'request is correct')
        t.same(query._scope, ['scope0'], 'request _namespace is correct')
        t.ok(query.normalized, 'request is normalized')
      })
      .mergeAll()
      .subscribe(x => {
        t.deepEqual(x, response, 'response is correct')
        t.end()
      })
    return {
      source: O.of(request)
    }
  }
  const request$ = new Subject()
  const source = customDriver(request$, rxAdapter)
  isolate(dataflow, 'scope0')({source}).source
    .subscribe((request) => {
      request$.onNext(request)
    })
  request$.onNext('Alex')
})

test('Progressive response driver', (t) => {
  const request = {name: 'John'}
  const response = 'async John'
  const source = progressiveDriver(O.of(request), rxAdapter)
  let values = []
  source.select()
    .do(r$ => t.deepEqual(r$.request, request, 'response$.request is present and correct'))
    .mergeAll()
    .subscribe(x => {
      values.push(x)
      if (values.length === 3){
        t.deepEqual(values, [1, 2, 3], 'progressive response is ok')
        t.end()
      }
    })
})

test('xstream run (isolation, cancellation)', (t) => {
  const requests0 = [{name: 'John', lazy: true}, {name: 'Alex', lazy: true}]
  const requests1 = [{name: 'Jane'}]

  const Dataflow = ({driver, request$}, number) => {
    return {
      result: driver.select()
        .flatten().map(data => ({
          number, data
        })),
      driver: request$
    }
  }

  const Main = ({driver}) => {
    const dataflow0 = isolate(Dataflow, 'scope0')({
      request$: xs.fromArray(requests0),
      driver
    }, '0')
    const dataflow1 = isolate(Dataflow, 'scope1')({
      request$: xs.fromArray(requests1),
      driver
    }, '1')
    return {
      result: xs.merge(dataflow0.result, dataflow1.result),
      driver: xs.merge(dataflow0.driver, dataflow1.driver)
    }
  }
  let count = 0
  xsCycle.run(Main, {
    result: (result$) => {
      result$.addListener({
        next: (res) => {
          if (res.number === '0') {
            t.is(res.data, 'async Alex')
            count++
          }
          if (res.number === '1') {
            t.is(res.data, 'async Jane')
            t.is(res.data, 'async Jane')
            count++
          }
          if (count >= 2){
            setTimeout(() => {
              t.is(count, 2, 'two requests done')
              t.ok(requests0[0].aborted, 'first lazy request aborted')
              t.notOk(requests0[1].aborted, 'second not aborted')
              t.notOk(requests1[0].aborted, 'third not aborted')
              t.end()
            }, 50)
          }
        },
        error: () => {},
        complete: () => {}
      })
      return {}
    },
    driver: basicDriver
  })
})

test('most run (isolation, cancellation)', (t) => {
  const requests0 = [{name: 'John', lazy: true}, {name: 'Alex', lazy: true}]
  const requests1 = [{name: 'Jane'}]

  const Dataflow = ({driver, request$}, number) => {
    return {
      result: driver.select()
        .switch().map(data => ({
          number, data
        })),
      driver: request$
    }
  }

  const Main = ({driver}) => {
    const dataflow0 = isolate(Dataflow, 'scope0')({
      request$: most.from(requests0),
      driver
    }, '0')
    const dataflow1 = isolate(Dataflow, 'scope1')({
      request$: most.from(requests1),
      driver
    }, '1')
    return {
      result: most.merge(dataflow0.result, dataflow1.result),
      driver: most.merge(dataflow0.driver, dataflow1.driver)
    }
  }
  let count = 0
  mostCycle.run(Main, {
    result: (result$) => {
      result$.subscribe({
        next: (res) => {
          if (res.number === '0') {
            t.is(res.data, 'async Alex')
            count++
          }
          if (res.number === '1') {
            t.is(res.data, 'async Jane')
            t.is(res.data, 'async Jane')
            count++
          }
          if (count >= 2){
            setTimeout(() => {
              t.is(count, 2, 'two requests done')
              t.ok(requests0[0].aborted, 'first lazy request aborted')
              t.notOk(requests0[1].aborted, 'second not aborted')
              t.notOk(requests1[0].aborted, 'third not aborted')
              t.end()
            }, 50)
          }
        },
        error: () => {},
        complete: () => {}
      })
      return {}
    },
    driver: basicDriver
  })
})