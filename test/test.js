import {run} from '@cycle/core'
import {createDriver} from '../lib/index'
import {Observable as O} from 'rx'
import isolate from '@cycle/isolate'
import test from 'tape'

var simpleDriver = createDriver((request) =>
  O.create(observer => {
    setTimeout(() => observer.onNext('async ' + request.name), 10)
  })
)

var asyncDriver = createDriver({
  createResponse$: (request) =>
    O.create(observer => {
      setTimeout(() => observer.onNext('async ' + request.name), 10)
    }),
  isolateMap: (name) =>
    typeof name == 'string' ? {name} : name,
  normalizeRequest: (name) =>
    typeof name == 'string' ? {name: name.toUpperCase()} : name.toUpperCase()
})

test('Check basic request with simple driver', (t) => {
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

test('Check basic request', (t) => {
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
        t.is(r, 'async JOHN')
        t.end()
      })
    }
  })
})
