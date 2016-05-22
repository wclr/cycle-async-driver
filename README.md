# cycle-async-driver
Higher order factory for creating [cycle.js](http://cycle.js.org) async request based drivers.
Allows you almost completely eliminate boilerplate code for this kind of drivers.

To put it simple: **Create fully functional cycle.js driver from async function with callback or promise**

## What is that?
Lets say you want to create simple (node) File System readFile driver: 
* you send requests (to sink) like `{path: 'path/to/file', stats: true}` 
* you get responses (from source) like `{data: FILEDATA, stats: FILESTATS}`

Or maybe you want to create some other *async driver* of the same type `(request) -> async response` 
that makes queries to **database/storage/queue**. 

Basically in this case you:
* probably want responses from driver be a "metastream" of responses (as they are async - witch response is a stream itself)
* may want it either *lazy* (start only when response$ has active subscribers) or *eager* (do request anyway immediately)
* may want build-in standard *isolate* mechanics (provided by `@cycle/isolate`)

How do you create such driver? If you do it first time, you probably go to source code of official 
[cycle HTTP driver](https://github.com/cyclejs/http/blob/master/src/http-driver.js) 
which basically has the same *async request/response* nature and end up with something like this for your 
FS readFile driver:

## *Without* `cycle-async-driver`

```js
import {Observable as O} from 'rx'
import fs from 'fs'

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
        Object.defineProperty(response$, 'request', {
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

## With `cycle-async-driver`

But actually it could be a little bit simpler. With `cycle-async-driver` 
you can **eliminate amost allof boilerplate** from your *lazy* File System readFile driver:

Simple case with standard `makeAsyncDriver` options:
```js
export const makeReadFileDriver = (options) => 
  makeAsyncDriver((request, callback) => {
      let readFile$ = O.fromNodeCallback(fs.readFile, fs)(request.path)
      return options.stats || options.stats
        ? O.combineLatest([
        readFile$,
        O.fromNodeCallback(fs.stat, fs)(request.path),
      ]).map(([data, stat]) => ({data, stat}))
        : readFile$.map(data => ({data}))
    })  
```

You may use also create driver using old node callback style returns, if you like this, 
`cycle-async-driver` will create observable response$ for you:
```js
export const makeReadFileDriver = (options) => 
  makeAsyncDriver((request, callback) => {
      if (options.stats || options.stats){
        fs.stat(request.path, (err, stats) => {
          err 
            ? callback(err)
            : fs.readFile(request.path, (err, data) => {
              callback(err, {data, stats})
            })
        })
      } else {
        fs.readFile(request.path, (err, data) => {
           callback(err, {data})
        })
      }  
    })  
```
Instead of using callback you also may return *native* `Promise` from `getResponse` function.

So what do you get using this helper to create your *async request/response* drivers:

* get rid of boilerplate code in your driver
* may be sure that you get your *eager/lasy* "metastream" of responses
* may be sure that standard *isolate* mechanics for your driver works.
* need just to ensure (to test) you technical domain driver logic
* it is also great for creating **mock drivers for your tests**

##Options 
Options passed to `makeAsyncDriver` helper:
* **createResponse$** (required, if no **getResponse**) - function that takes `request` and returns `response$`
* **getResponse** (required, if no **createResponse$**) - function that takes `request` and returns `Promise` or uses second passed `callback` param to return callback in node style.
* **requestProp** (default: `request`) - name of property that is *attached* to `response$` that will contain *normalized* request data, can be `false`
* **responseProp** (default: `false`) - if set to `false`, `response$` items will contain corresponding `request` 
be wrapped in `{response: ..., request: ....}`, if this prop set to `true` 
then default name value `response` is used.
* **normalizeRequest** (default: `_ => _`) - function of `request` normalization
* **eager** (default: `true`) - makes `response$` *eager* (hot, starts immediately) or *lazy* (cold, starts when has active subscriptions) 
* **isolate** (default: `true`) - build-in `isolate` mechanics
* **isolateProp** (default: `_namespace`) - prop name that is attached to request object to *isolate* it
* **isolateMap** (default: `_ => _`) - how map request in `isolateSink` (`normalizeRequest` will be used instead)
* **isolateSink** - use custom `isolateSink` method
* **isolateSource** - use custom `isolateSource` method
* **selectorMethod** (default: `select`) - custom name of selector method, if `false` helper is not attached
* **selectorProp** (default: `category`) - custom name of selector property, if`false` helper is not attached
* **flatten** (default: ['success', 'failure']) - custom names for flattening (merge latest) helpers, if`false` helpers are not attached
* **flattenAll** (default: ['successAll', 'failureAll']) - custom names for flattening (merge all) helpers, if`false` helpers are not attached

## Filtering helper (`select`) 
Useful for easier filtering `responses$` by `request` properties, you can filter request object either: 
* by default driver property (`category` by default if not set custom)
* by provider property  (first parameter to `select`, second is match)
* by multiple properties providing object {....}

If `match` param **can be RegExp** then `match.test` function will be used for testing,
or it can be a **testing function** itself,  otherwise `request` property will be checked 
for **strict equality** with `match` param.

Technically this helper just applies advanced `filter` on `request` property of `response$$` stream.

## Flattening helpers (`success`, `failure`, `successAll`, `failureAll`)
Useful for dealing with async responses errors, it also allows you to get access to corresponding request.
So may not bother of *catching* errors and get uninterrupted stream of *successes* or *errors*.  

```js
const main = ({asyncDriver}) => {
    // get only `first` `class` failure responses
    const firstFailed$ = asyncDriver        
        .select('class', 'first') // if two params passed, first is treated as selector prop name
        .failure((e, request) => `failure for mark ${request.mark}`) // you can provider mapping function into helper
    
    // get only `second` `class` success responses
    const secondSuccessul$ = asyncDriver
    .select({'class': 'second'})
    .filter(r$ => r$.request.mark[0] === 'T' )
    .success((response, request) => {...}) // notice that you can use helpers after filtering
    
    return {
      // we send some requests to driver
      asyncDriver: O.from([
        {mark: 'BMW', class: 'first'},
        {mark: 'Mercedess', class: 'first'},
        {mark: 'Toyota', class: 'second'}
      ]),       
    }
  }
```

Technically `success` helper just *catches* errors on the `response$` stream 
and turns them into `empty` stream, so consumer just don't see them, 
and `failure` helper does vice versa.

`success` and `failure` get only latest response, `successAll` and `failureAll` 
merge all responses results.

## Pull helper (`pull`)
**Experimental.* Allow to initialize pulling from driver.  
```js
    db.pull({find: {...}}, interval(1000))
```

```js   
  HTTP.pull('/api/tasks', interval(5000)).success(...)
```

## External use of helpers (with other async drivers)
You can use it for example with official `HTTP` driver, like detached helper functions:  

```js
import {success, failure, select} from 'cycle-async-driver'
...

let allSuccessful$ = success(select(HTTP, 'url', '/api/users'))
let filteredFailed$ = failure(HTTP.filter(...))

// or

let allSuccessful$ = HTTP
    .let(select({method: 'POST', url: /users/}))
    .let(success)

let filteredFailed$ = HTTP.filter(...).let(failure)

// or
let allSuccessful$ = HTTP.let(success(respose => ...))

let filteredFailed$ = HTTP.filter(...)
  .let(select({method: 'POST', url: /users/}))
  .let(failure((error, request) => ...))

```

To use fluent API you can attach this helpers to driver it self:
```js
import {attachHelpers} from 'cycle-async-driver'

...

const httpDriver = makeHTTPDriver({eager: true}) 
// you can use custom helpers name
httpDriver = attachHelpers(httpDriver, {
  flatten: ['successful', 'failed'],
  selectorMethod: 'onlyIf' // if `false` will not attach 
}) 

...

const main = ({DOM, HTTP}) => {
  let usersPostSuccessful$ = HTTP
    .onlyIf({url: /users/, method: 'POST'}) // you can use object to match more then one property in request
    .successful()
  let filteredFailed$ = HTTP.filter(...).failed()
  ...
} 

run(main, {
  DOM: makeDOMDriver()
  HTTP: httpDriver
})
```

## Install 
`npm install cycle-async-driver -S`

## Tests
```
npm install
npm run test
```
For running test in dev mode with watching `node-dev` should be installed globally (`npm i node-dev -g`) 
