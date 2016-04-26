import {run} from '@cycle/core'
import {makeAsyncDriver} from '../lib/index'
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


var asyncDriver = makeAsyncDriver({
  createResponse$: (request) =>
    O.create(observer => {
      setTimeout(() => observer.onNext({asyncName: 'async ' + request.name}), 10)
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

test('successful and failed helpers', (t) => {
  let mergedCount = 0
  let successfulCount = 0
  let failedCount = 0
  const main = ({async}) => {
    return {
      async: O.of('John', 'Mary', '', 'Alex', 'Jane', '', 'Mike').delay(1),
      merged: async.mergeAll().catch(O.empty()),
      success: async
        .filter(r$ => r$.request.name)
        .filter(r$ => r$.request.name !== 'Alex')
        .successful(({response, request}) =>
        ({response: response + ' mapped', request})
      ),
      fail: async.failed(({error, request}) =>
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
        successfulCount++
        //console.log('success', r)
        t.is(r.response, `async ${r.request.name} mapped`, 'successful response mapped')
      })
    },
    fail: (error$) => {
      error$.subscribe(r => {
        failedCount++
        t.is(r.error, 'async error mapped', 'error in `error` wrapped ok')
        t.is(r.request.name, '', 'error contains request')
      })
    }
  })
  setTimeout(() => {
    t.is(mergedCount, 2, 'merged count correct')
    t.is(successfulCount, 4, 'successful count correct')
    t.is(failedCount, 2, 'failed count correct')
    t.end()
  }, 100)
})

test('select helper', (t) => {
  let selectedCount = 0
  const main = ({async}) => {
    return {
      async: O.from([
        {name: 'John', category: 'good'},
        {name: 'Alex', category: 'bad'},
        {name: 'Jane', category: 'good'}
      ]).delay(0),
      result: async.select('good').successful()
    }
  }
  run(main, {
    async: simpleDriver,
    result: (response$) => {
      response$.subscribe(r => {
        selectedCount++
      })
    }
  })
  setTimeout(() => {
    t.is(selectedCount, 2, 'selected count correct')
    t.end()
  }, 100)
})