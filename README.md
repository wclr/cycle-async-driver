# cycle-async-driver
Helper that allows you to get rid of boilerplate code when creating cycle.js async requests based drivers.

## What is that?
Lets say you want to create simple (node) File System readFile driver, 
You send requests to driver `{path: 'path/to/file', stats: true}` 
and get responses like `{data: FILEDATA, stats: FILESTATS}`

Or maybe some other async driver of the same type `(request) -> async response` like queries to database/storage/queue. 

Basically in this case you:
* probably want responses from driver be a "metastream" (as they are async)
* may want it either *lazy* or *eager*
* may want build-in standard *isolate* mechanics

How to create such driver? You probably go to source code of standard [cycle HTTP driver] 
which basically has the same *async request/response* nature and end up with something like this for your 
FS readFile driver:

```js
const isolateSink = (request$, scope) => {
  return request$.map(req => {
    if (typeof req === 'string') {
      return {path: req, _namespace: [scope]}
    }
    req._namespace = req._namespace || []
    req._namespace.push(scope)
    return req
  })
}

const isolateSource = (response$$, scope) => {
  let isolatedResponse$$ = response$$.filter(res$ =>
    Array.isArray(res$.request._namespace) &&
    res$.request._namespace.indexOf(scope) !== -1
  )
  isolatedResponse$$.isolateSource = isolateSource
  isolatedResponse$$.isolateSink = isolateSink
  return isolatedResponse$$
}

const normalizeRequest = (request) => {
  if (typeof request === 'string') {
    return {path: request}
  } else {
    return request
  } 
} 

export function makeFileReadDriver (options) {
  const createResponse$ = (request) => {
    let readFile$ = O.fromNodeCallback(fs.readFile, fs)(request.path)
    return options.stats || request.stats
      ? O.combineLatest([
      readFile$,
      O.fromNodeCallback(fs.stat, fs)(request.path),
    ]).map(([data, stat]) => ({data, stat}))
      : readFile$.map(data => ({data}))
  }
  
  return function driver (request$) {
    let response$$ = request$
      .map(request => {
        const reqOptions = normalizeRequest(request)
        let response$ = createResponse$(reqOptions)
        if (typeof reqOptions.eager === 'boolean' ? reqOptions.eager : eager) {
          response$ = response$.replay(null, 1)
          response$.connect()
        }
        Object.defineProperty(response$, requestProp, {
          value: reqOptions,
          writable: false
        })
        return response$
      })
      .replay(null, 1)
    response$$.connect()
    if (isolate){
      response$$.isolateSource = isolateSource
      response$$.isolateSink = isolateSink
    }
    return response$$
  }
}
```

##With `cycle-async-driver`

But actually it could much be simpler with `cycle-async-driver` to have *lazy* File System readFile driver:

```js
import {Observable as O} from 'rx'
import fs from 'fs'
import {createDriver} from 'cycle-async-driver'

const normalize = (path) => 
  typeof path == 'string' ? {path} : path                        

export const makeReadFileDriver = (options) =>
  createDriver({
    eager: false,
    createResponse: (request) => {
      let readFile$ = O.fromNodeCallback(fs.readFile, fs)(request.path)
      return options.stats || options.stats
        ? O.combineLatest([
        readFile$,
        O.fromNodeCallback(fs.stat, fs)(request.path),
      ]).map(([data, stat]) => ({data, stat}))
        : readFile$.map(data => ({data}))
    },
    normalizeRequest: normalize,
    isolateMap: normalize
  })
```

Or even more simple in basic case (with standard `createDriver` options):
```js
export const makeReadFileDriver = (options) => 
  createDriver((request) => {
      let readFile$ = O.fromNodeCallback(fs.readFile, fs)(request.path)
      return options.stats || options.stats
        ? O.combineLatest([
        readFile$,
        O.fromNodeCallback(fs.stat, fs)(request.path),
      ]).map(([data, stat]) => ({data, stat}))
        : readFile$.map(data => ({data}))
    })  
```

So what do you get using this helper to create your *async request/response* drivers:

* You may be sure that you get your *lazy/eager* "metastream" of responses
* You may be sure that standard *isolate* mechanics for your driver works.
* You need just to be sure in (to test) you technical domain driver logic for getting response.

##Options 
Options passed to `createDriver` helper:
* **createResponse$** (required) - function that takes `request` and returns `response$` 
* **requestProp** (default: `request`) - name of property that is *attached* to `response$` that will contain *normalized* request data, can be `false`
* **normalizeRequest** (default: `_ => _`) - function of `request` normalization
* **eager** (default: `true`) - make 
* **isolate** (default: `true`) - build-in `isolate` mechanics
* **isolateProp** (default: `_namespace`) - prop name that is attached to request object to *isolate* it
* **isolateMap** (default: `_ => _`) - how map request in `isolateSink` (in terms if not object)
* **isolateSink** - use custom `isolateSink` method
* **isolateSource** - use custom `isolateSource` method

## Tests
```
npm install
npm run test
```
For running test in dev mode with watching `node-dev` should be installed globally (`npm i node-dev -g`) 
