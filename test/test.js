import {run} from '@cycle/core'
import {makeAsyncDriver, attachHelpers, success, failure, select} from '../lib/index'
import {Observable as O} from 'rx'
import isolate from '@cycle/isolate'
import test from 'tape'

var simpleDriver = makeAsyncDriver((request) =>
  O.create(observer => {
    setTimeout(() => observer.onNext('async ' + request.name), 10)
  })
)

var simpleDriverFromCallback = makeAsyncDriver({
  getResponse: (request, cb) => {
    setTimeout(() => cb(null, 'async ' + request.name), 10)
  },
  responseProp: true
})

var simpleDriverFromPromise = makeAsyncDriver({
  getResponse: (request, cb) =>
    // return promise
    new Promise(resolve =>
      setTimeout(() => resolve('async ' + request.name), 10)
    ) 
})

var driverWithFailure = makeAsyncDriver({
  normalizeRequest: (name) =>
    typeof name === 'string' ? {name} : name,
  getResponse: (request, cb) => {
    return new Promise((resolve, reject) =>
      request.name
        ? resolve('async ' + request.name)
        : reject('async error')
    )
  },
  responseProp: true
})

var driverWithPull = makeAsyncDriver({
  usePullDriver: false,
  normalizeRequest: (name) =>
    typeof name === 'string' ? {name} : name,
  getResponse: (request, cb) => {
    return new Promise((resolve, reject) =>
      request.name
        ? resolve('async ' + request.name)
        : reject('async error')
    )
  },
  responseProp: true
})



var asyncDriver = makeAsyncDriver({
  createResponse$: (request) =>
    O.create(observer => {
      setTimeout(() => request.name
        ? observer.onNext({asyncName: 'async ' + request.name})
        : observer.onError('async error'), 10)
    }),
  requestProp: 'query',
  normalizeRequest: (name) =>
    typeof name === 'string'
      ? {name: name.toUpperCase()}
      : {...name, name: name.name.toUpperCase()},
  isolateProp: '_scope',
  isolateMap: (name) =>
    typeof name === 'string' ? {name} : name
})

test('Basic request with simple driver', (t) => {
  const main = ({async}) => {
    return {
      async: O.just({name: 'John'}),
      result: async.switch()
    }
  }
  run(main, {
    async: simpleDriver,
    result: (response$) => {
      response$.subscribe(r => {
        t.is(r, 'async John')
        t.end()
      })
    }
  })
})

test('Basic request with simple driver (from callback)', (t) => {
  const main = ({async}) => {
    return {
      async: O.just({name: 'John'}),
      result: async.switch()
    }
  }
  run(main, {
    async: simpleDriverFromCallback,
    result: (response$) => {
      response$.subscribe(r => {
        t.is(r.response, 'async John')
        t.end()
      })
    }
  })
})

test('Basic request with simple driver (from promise)', (t) => {
  const main = ({async}) => {
    return {
      async: O.just({name: 'John'}),
      result: async.switch()
    }
  }
  run(main, {
    async: simpleDriverFromPromise,
    result: (response$) => {
      response$.subscribe(r => {
        t.is(r, 'async John')
        t.end()
      })
    }
  })
})

test('Basic request', (t) => {
  const main = ({async}) => {
    return {
      async: O.just('John'),
      result: async.switch()
    }
  }
  run(main, {
    async: asyncDriver,
    result: (response$) => {
      response$.subscribe(r => {
        t.is(r.asyncName, 'async JOHN')
        t.end()
      })
    }
  })
})

test('Two isolated requests', (t) => {
  const SendQuery = ({params, async}) => {
    return {
      async: O.just(params),
      result: async
    }
  }
  const main = ({async}) => {
    let query1 = isolate(SendQuery)({params: {name: 'John'}, async})
    let query2 = isolate(SendQuery)({params: 'Jane', async})
    return {
      async: O.merge(query1.async, query2.async.delay(1)),
      result: O.merge([
        query1.result, query2.result
      ]).flatMap(r$ => r$.do(r => r.query = r$.query))
    }
  }
  let count = 0
  run(main, {
    async: asyncDriver,
    result: (response$) => {
      response$.forEach(r => {
        if (r.asyncName == 'async JOHN'){
          t.is(r.query.name, 'JOHN', 'custom `query` request property has normalized request')
          t.ok(r.query._scope, 'custom `_scope` property is ok')
        }
        if (r.asyncName == 'async JANE'){
          t.is(r.query.name, 'JANE', 'custom `query` request property has normalized request')
          t.ok(r.query._scope, 'custom `_scope` property is ok')
        }
        if (++count === 2){
          setTimeout(() => {
            t.is(count, 2, 'responses count is ok, isolation is ok')
            t.end()
          })
        }
      })
    }
  })
})

test('success and failure helpers', (t) => {
  let mergedCount = 0
  let successCount = 0
  let failureCount = 0
  const main = ({async}) => {
    return {
      async: O.of('John', 'Mary', '', 'Alex', 'Jane', '', 'Mike').delay(1),
      merged: async.mergeAll().catch(O.empty()),
      success: async
        .filter(r$ => r$.request.name)
        .filter(r$ => r$.request.name !== 'Alex')
        .success(({response, request}) =>
        ({response: response + ' mapped', request})
      ),
      fail: async.failure(({error, request}) =>
        ({error: error + ' mapped', request})
      )
    }
  }
  run(main, {
    async: driverWithFailure,
    merged: (response$) => {
      var count = 0
      response$.subscribe(r => {
        mergedCount++
      })
    },
    success: (response$) => {
      response$.subscribe(r => {
        successCount++
        t.is(r.response, `async ${r.request.name} mapped`, 'success response mapped')
      })
    },
    fail: (error$) => {
      error$.subscribe(r => {
        failureCount++
        t.is(r.error, 'async error mapped', 'error in `error` wrapped ok')
        t.is(r.request.name, '', 'error contains request')
      })
    }
  })
  setTimeout(() => {
    t.is(mergedCount, 2, 'merged count correct')
    t.is(successCount, 4, 'success count correct')
    t.is(failureCount, 2, 'failure count correct')
    t.end()
  }, 500)
})

test('detached success and failure helpers', (t) => {
  let mergedCount = 0
  let successCount = 0
  let failureCount = 0
  const main = ({async}) => {
    return {
      async: O.from([
        'John',
        'Mary',
        {name: '', maker: true},
        'Alex',
        '',
        'Jane',
        {name: '', maker: true},
        'Mike'
      ]).delay(1),
      merged: async.mergeAll().catch(O.empty()),
      success: async
        .filter(r$ => r$.request.name)
        .let(select({name: (_) => !/Alex/.test(_)}))
        .let(
          success(({response, request}) =>
            ({response: response + ' mapped', request})
          )
        ),
      fail: select(async, {maker: true}).let(failure).map(({error, request}) =>
        ({error: error + ' mapped', request})
      )
    }
  }
  run(main, {
    async: driverWithFailure,
    merged: (response$) => {
      var count = 0
      response$.subscribe(r => {
        mergedCount++
      })
    },
    success: (response$) => {
      response$.subscribe(r => {
        successCount++
        //console.log('success', r)
        t.is(r.response, `async ${r.request.name} mapped`, 'success response mapped')
      })
    },
    fail: (error$) => {
      error$.subscribe(r => {
        failureCount++
        t.is(r.error, 'async error mapped', 'error in `error` wrapped ok')
        t.is(r.request.name, '', 'error contains request')
      })
    }
  })
  setTimeout(() => {
    t.is(mergedCount, 2, 'merged count correct')
    t.is(successCount, 4, 'success count correct')
    t.is(failureCount, 2, 'failure count correct')
    t.end()
  }, 500)
})


test('select helper', (t) => {
  let selectedCount = 0
  let selectedWithObjCount = 0
  let selectedWithPropCount = 0
  const main = ({async}) => {
    return {
      async: O.from([
        {name: 'John', category: 'good'},
        {name: 'Alex', category: 'bad'},
        {name: 'Jane', category: 'good'}
      ]).delay(0),
      selected: async.select('good'),
      selectedWithObj: async.select({name: 'Alex'}),
      selectedWithProp: async.select('name', 'Alex')
    }
  }
  run(main, {
    async: simpleDriver,
    selected: (response$) => {
      response$.subscribe(r => {
        selectedCount++
      })
    },
    selectedWithObj: (response$) => {
      response$.subscribe(r => {
        selectedWithObjCount++
      })
    },
    selectedWithProp: (response$) => {
      response$.subscribe(r => {
        selectedWithPropCount++
      })
    }
  })
  setTimeout(() => {
    t.is(selectedCount, 2, 'selected with simple match count correct')
    t.is(selectedWithObjCount, 1, 'selected with object match count correct')
    t.is(selectedWithPropCount, 1, 'selected with property match count correct')
    t.end()
  }, 100)
})

test('attachHelpers: custom helpers attached', (t) => {
  asyncDriver = attachHelpers(asyncDriver, {
    flatten: ['successful', 'failed'],
    selectorMethod: 'onlyIf',
    requestProp: 'query'
  })

  let mergedCount = 0
  let successCount = 0
  let failureCount = 0
  const main = ({asyncDriver}) => {
    return {
      asyncDriver: O.of('John', 'Mary', '', 'Alex', 'Jane', '', 'Mike').delay(1),
      merged: asyncDriver.mergeAll().catch(O.empty()),
      success: asyncDriver.onlyIf({name: _ => _ !== 'ALEX'})
        .successful((response, query) =>
          ({response: response.asyncName + ' mapped', query})
        ),
      fail: asyncDriver.failed((error, query) =>
          ({error: error + ' mapped', query})
      )
    }
  }
  run(main, {
    asyncDriver: asyncDriver,
    merged: (response$) => {
      var count = 0
      response$.subscribe(r => {
        mergedCount++
      })
    },
    success: (response$) => {
      response$.subscribe(r => {
        successCount++
        t.is(r.response, `async ${r.query.name} mapped`, 'success response mapped')
      })
    },
    fail: (error$) => {
      error$.subscribe(r => {
        failureCount++
        t.is(r.error, 'async error mapped', 'error in `error` wrapped ok')
        t.is(r.query.name, '', 'error contains request')
      })
    }
  })
  setTimeout(() => {
    t.is(mergedCount, 2, 'merged count correct')
    t.is(successCount, 4, 'success count correct')
    t.is(failureCount, 2, 'failure count correct')
    t.end()
  }, 500)
})


test('Pull request', (t) => {
  const main = ({async}) => {
    return {
      result: async.pull(O.just({name: 'John'})).mergeAll()
    }
  }
  run(main, {
    async: driverWithFailure,
    result: (response$) => {
      response$.subscribe(r => {
        t.is(r.response, 'async John')
        t.end()
      })
    }
  })
})

test('Static pull request with sampler stream', (t) => {
  const main = ({async}) => {
    let sampler$ = O.interval(10)
      //.do(x => console.log('tick'))
    //let sampler$ = O.just(1000).do(x => console.log('tick'))
    return {
      result: async.pull({name: 'John'}, sampler$).mergeAll()
    }
  }
  const {sources, sinks} = run(main, {
    async: driverWithFailure,
    result: (response$) => {
      response$.subscribe(r => {
        sinks.dispose()
        sources.dispose()
        t.is(r.response, 'async John')
        t.end()
      })
      return {}
    }
  })
})

test('Pull request (no pull driver)', (t) => {
  let count = 0
  let pullCount = 0

  const main = ({async}) => {
    return {
      async: O.just({name: 'Mary'}).delay(10),
      result: async.mergeAll(),
      pullResult: async.pull(O.just({name: 'John'})).mergeAll()
    }
  }
  run(main, {
    async: driverWithPull,
    result: (response$) => {
      response$.subscribe(r => {
        //console.log('response,', r)
        count++
        t.is(r.response, 'async Mary')
      })
    },
    pullResult: (response$) => {
      response$.subscribe(r => {
        //console.log('pull response,', r)
        pullCount++
        t.is(r.response, 'async John')
      })
    }
  })
  setTimeout(() => {
    t.is(count, 1, 'count of responses ok')
    t.is(pullCount, 1, 'count of pull responses ok')
    t.end()
  }, 100)
})

test('Static pull request w/o sampler', (t) => {
  const main = ({async}) => {
    return {
      result: async.pull({name: 'John'})
        .mergeAll()
    }
  }
  run(main, {
    async: driverWithFailure,
    result: (response$) => {
      response$.subscribe(r => {
        t.is(r.response, 'async John')

        setTimeout(() => {
          t.end()
        }, 5000)
      })
    }
  })
})