# cycle-async-driver
> Higher order factory for creating [cycle.js](http://cycle.js.org) async request/response drivers.

![npm (scoped)](https://img.shields.io/npm/v/cycle-async-driver.svg?maxAge=86400)

```bash
npm install cycle-async-driver -S
```

> Notice that API of version 2.x has significantly changed since 
[1.x](https://github.com/whitecolor/cycle-async-driver/tree/e1edceb28fc808e755449c3dbf0073184135dfa8),
 which where using `rxjs4` and has some excessive features that where removed in 2.x.

Allows you easily create fully functional **cycle.js driver** 
which side effect is executed using async function with **promise or callback**.
It also can serve as a simple backbone for your more sophisticated driver.

Such driver will work in the same manner as 
[official cycle HTTP driver](https://github.com/cyclejs/cyclejs/tree/master/http), so basically:

* driver sink will expect stream of requests
* driver source will provide you with "metastream" of responses
* driver source will provide  standard *isolate* mechanics (`@cycle/isolate`)
* driver will be compatible with any stream library that cycle.js can work with 
(it doesn't use any under the hood, but uses cyclejs stream adapter's API).

## API

### `makeAsyncDriver`

Async driver factory.

- `getResponse` *(Function)*: function that takes `request` object as first param 
and `callback` as second param 
returns any kind of Promise or uses passed node style `callback` 
to give back async response for passed `request`. **required** (if no `getProgressiveResponse`)

- `getProgressiveResponse` *(Function)*: function that takes `request` object as first param 
and `observer` object as second param which allows to create a custom response 
containing more then one value. **required** (if no `getResponse`)

- `normalizeRequest` *(Function)*: transform function that will be applied to the request before handling.

- `requestProp` *(String)*: name of the property that will be attached to every response stream. *default value: **request***

- `isolate` *(Boolean)*: makes driver ready to work with `@cycle/isolate`. *default value: **true***

- `isolateNormalize` *(Function)*: transform function that will be 
applied to the request before its isolation, if not present `normalizeRequest` will be used instead.

- `isolateProp` *(String)*:  name of the property that will be used for keeping isolation namespace. *default value: **_namespace***

- `lazy` *(Boolean)*: makes all driver requests lazy by default, 
can be overridden by particular request options. *default value: **false***

## Usage

#### Basic example
Let's create cycle.js driver which will be able to read files 
using node.js `fs` module:

```js
import {makeAsyncDriver} from 'cycle-async-driver'
import fs from 'fs'
import {run} from '@cycle/rx-run' 
import {Observable as O} from 'rx'
 
let readFileDriver = makeAsyncDriver((request, callback) => {
  fs.readFile(requst.path, request.encoding || 'utf-8', callback)
  // instead of using `callback` param you may return Promise 
})

...

const Main = ({readFile}) => {
  return {
    readFile: O.of({path: '/path/to/file/to/read'}),
    output: read
      .select()
      // select() is used to get all response$ streams
      // you may also filter responses by `category` field 
      // or by request filter function      
      .mergeAll()
      // as we get metastream of responses - 
      // we should flatten it to get file data 
  } 
}

run(Main, {
  output: (ouput$) => ouput$.forEach(::console.log) 
  readFile: readFileDriver
})

```

#### Metastream of responses

`makeAsyncDriver` creates a driver source which is an object that you use
to access and manage responses that come from your driver.

#### Request error handling
One of recommended ways of dealing with successful and failed
requests from driver is to use halpers that will filter 
requests with needed result:

```js
// rxjs 
let failure = (r$$) => r$$.map(r$ => r$.skip().catch(of))
let success = (r$$) => r$$.map(r$ => r$.catch(empty))
```

```js
// xstream
let failure = (r$$) => r$$.map(r$ => r$.drop().replaceError(xs.of))
let success = (r$$) => r$$.map(r$ => r$.replaceError(xs.empty))
```

Then you can get only successful responses without errors:
```js
// rxjs
HTTP.select()
  .let(success)
  .switch()
```
```js
// xstream
HTTP.select()
  .compose(success)
  .flatten() 
```
**Notice** that if you handle/catch an error on the flattened `response$$` like that:
```js
// rxjs
yourDriver
  .select() // responses$$ stream
  .mergeAll() // flatten stream of all plain responses
  .catch(error => of({error})) // replace the error
  // this stream will not have exception 
  // but will end right after first error caught
```
the stream will be completed and you wan't get there anything after first error.

#### Accessing response/request pairs
Sometimes you may find yourself in a need to access corresponding
response and request pairs, to do this follow such approach:

```js       
  const getPairs = r$ => r$.map(res => ({res, req: r$.request}))  
  // get all succesfful response/request pairs
  let goodResReqPair$ = asyncDriver.select()
    .let(success)
    .map(getPairs)
    .mergeAll()      
```

#### Cancellation (and abortion)
Basically, when you want request to be cancelled you should 
stop listening to `response$` (response stream) corresponding 
to particular request that should be canceled,
often it is done using flattening the stream of responses 
to the latest response:  
 
```js
// rxjs
myCoolDriver
  .select('something_special')
  .flatMapLatest() // or .switch()
  .map(...)
  // so here you will get only responses from last request started
  // you won't see responses of the requets that started before 
  // the last one and were not finished before  
```
 
 If you want to implement driver that on cancellation makes 
 some action - for example aborts not completed requests, you should follow this approach:
 
```js
import {makeAsyncDriver} from 'cycle-async-driver'
 
// this example also shows you how to use `getProgressiveResponse`
// say we have some `coolSource` to which we can make requests
// and get some response stream back, 
// and we want translate it to the cycle driver
let myCoolDriver = makeAsyncDriver({
  getProgressiveResponse: (request, observer, onDispose) => {  
    const coolRequest = coolSource.makeRequest(request, (coolStream) => {
      coolStream.on('data', observer.next)
      coolStream.on('error', observer.error)
      coolStream.on('end', observer.completed)
    })
    // third param of `getResponse` or `getProgressiveResponse`
    // is a function `onDispose` that takes
    // a handler which will be called when no listeners 
    // is needing response for this request anymore,   
    // in this case if it happens before the request is completed 
    // you may want to abort it
    onDispose(() => !coolRequest.isCompleted() && coolRequest.abort())   
  }
})
```

#### Lazy drivers and requests

By default all requests are eager (start to perform a side effect just after 
they get "into" the driver) and response streams (which correspond to particular request)
are hot (multicated) and remembered (has short memory) which means 
that any number of subscriber may listen to response stream  and while only one request will be performed 
all the subscribers will get response value(s), even late subscribers will 
get the **one last value** from response stream 
(you should consider this when dealing with progressive responses).
 
Lazy request on another had will start performing side effect 
before they get first subscriber. Depending of the stream library you use
for lazy requests you will get either cold (*rxjs*, *most*) 
or hot (*xstream* - where all streams are hot) response$ stream.

To get lazy driver just pass `lazy` option set to `true`:
```js
let readFileDriver = makeAsyncDriver({
  getResponse: request, callback) => {
    fs.readFile(requst.path, request.encoding || 'utf-8', callback)   
  },
  lazy: true
})
```

Or you can always make any request *lazy* if required 
by adding `lazy: true` option to the request inside your app's logic:
```js
  readFile: O.of({
   path: '/path/to/file/to/read',
   lazy: true
  }),
```


## Tests
```
npm install
npm run test
```
For running test in dev mode with watching `node-dev` should be installed globally (`npm i node-dev -g`) 
