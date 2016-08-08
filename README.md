# cycle-async-driver
> Higher order factory for creating [cycle.js](http://cycle.js.org) async request/response drivers.

![npm (scoped)](https://img.shields.io/npm/v/cycle-async-driver.svg?maxAge=86400)

> Notice that API of version 2.x has significantly changed since 
[1.x](https://github.com/whitecolor/cycle-async-driver/tree/e1edceb28fc808e755449c3dbf0073184135dfa8),
 which where using `rxjs4` and has some excessive features that where removed in 2.x.

```bash
npm install cycle-async-driver -S
```

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

- `isolate` *(Boolean)*: makes driver ready to work with [`@cycle/isolate`](#isolation). *default value: **true***

- `isolateNormalize` *(Function)*: transform function that will be 
applied to the request before its isolation, if not present `normalizeRequest` will be used instead.

- `isolateProp` *(String)*:  name of the property that will be used for keeping isolation namespace. *default value: **_namespace***

- `lazy` *(Boolean)*: makes all driver requests [lazy](#lazy-drivers-and-requests) by default, 
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

`makeAsyncDriver` creates a driver function which accepts 
stream of requests (`request$`) and returns driver source 
which is an object that you use to access responses that come from the driver.

To access responses driver sources provides special selector method 
(`select` is default name) which takes nothing or *string* `category` 
(default name of selector property) and returns stream with all responses 
or filtered by request's `category` field.

Stream returned by `select()` is a metastream of responses. This means
that each element of it is a stream itself, so it is **a stream of streams**
and usually referred as `response$$` (stream of `response$`). 
Each element of it is `response$` stream that produces resulting values 
originated from particular request you send to driver sink (`request$`). 

```js
// to get plain response data you should flatten metastream of repsonses
Driverstream
  .select('something-special') // returns metastream of responses (response$$)
  .mergeAll() // gets flatten stream of repsonses data
```

Each `response$` has attached 
property `request` (default name) which contains corresponding 
*normalized* request. In simple case this stream produces only 
one resulting value (actual response data). In case of *progressive* response
it may produce multiple values before completion. 

Also driver source has method `filter` witch takes filtering function for 
`response$$` metastream and  returns *filtered* driver source.

```js
// is some cases you may want to get filtered source
Driverstream
  .filter(r$$ => r$$.request.method === 'DELETE') // returns filtered driver source
  .select() // gets all response$$ stream  
```

Each of `response$` streams 
**potentially may produce an error** which should be [properly handled](#requests-error-handling). 
Metastream `response$$` will produce an error only if `request$` 
produces it and will **end** when `request$` stream completes.  

#### Isolation

By default driver source will provider 
[standard isolation](https://github.com/cyclejs/cyclejs/tree/master/isolate) 
strategy based on scoped namespaces. For this to each `request` object 
passed though isolated component boundaries isolation scope value
is attached to it using special property `_namespace` (default name). 
Isolated driver source will automatically filter responses 
corresponding to requests belonging to isolation scope. 
So parent components **have access to isolated child's** responses. 

#### Requests error handling

As it was said that `select()` method returns metastream of responses
(`response$$`), which produces response streams (`response$`) each of which 
may produce an error if something goes wrong while performing request.

It was mentioned also that to for responses you need eventually to flatten 
metastream of responses. But **notice** that if you handle/catch an error 
on the flattened `response$$` like that:
 ```js
 // rxjs
 yourDriver
   .select() // responses$$ stream
   .mergeAll() // flatten stream of all plain responses
   .catch(error => of({error})) // replace the error
   // this stream will not have exception 
   // but will end right after first error caught
 ```
the stream will be completed and you **won't get there anything after first error**.
  
So usually for proper handling you need to handle error 
on each response stream (`response$`), for example like that:
 
```js
// xstream
yourDriver
  .select() // responses$$ stream
  .map(r$ => r$ // catch error for each response$
    .map(success => ({success}))
    .replaceError(error => ({error}))
  )
```

One of the recommended methods of dealing with successful and failed
requests from driver is to use simple helpers that will leave 
requests with needed result:

```js
// rxjs 
let failure = r$ => r$.skip().catch(of)
let success = r$ => r$.catch(empty)
```

```js
// xstream
let failure = r$ => r$.drop().replaceError(xs.of)
let success = r$ => r$.replaceError(xs.empty)
```

Then you can get only successful responses without errors:
```js
// rxjs
HTTP.select()
  .flatMapLatest(success)
```
```js
// xstream
HTTP.select()
  .map(success)
  .flatten() 
```

#### Accessing response/request pairs
Sometimes you may find yourself in a need to access corresponding
response and request pairs, to do this follow such approach:

```js       
  const getPairs = r$ => r$.map(res => ({res, req: r$.request}))  
  // get all succesfful response/request pairs
  let goodResReqPair$ = asyncDriver.select()
    .map(success)
    .map(getPairs)
    .mergeAll()      
```
You can even create something like that:
```js       
  // create such success mapper factory
  const success = (mapper = (_ => _)) => 
    r$ => r$.catch(empty).map(res => mapper(res, r$.request))
  ...
  // map succesfful response/request pair to something
  let goodReqResMapped$ = asyncDriver.select()
    .flatMap(success(
      (response, request) => ...
    ))              
```
*It is all functional approach. Compose functions as you feel it needs to be.*

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
// and we want translate it to a cycle driver
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

By default **all requests are eager** (start to perform a side effect just after 
they get "into" the driver) and response streams (which correspond to particular request)
are **hot (multicated)** and **remembered** (has short memory) which means 
that any number of subscriber may listen to response stream  and while only one request will be performed 
all the subscribers will get response value(s), even late subscribers will 
get the **one last value** from response stream 
(you should consider this when dealing with progressive responses).
 
Lazy request on the other hand starts performing side effect 
when they get subscriber. Depending of the stream library you use
for lazy requests you will get either cold (*rxjs*, *most*) 
or hot (*xstream* - where all streams are hot) `response$` stream. 

Note that if you subscribe to lazy and **cold stream** (`response$`) in you app, 
**request will start to be performed each time you subscribe** to it, 
this thing is very important to consider (when using rx.js, most.js).

To get lazy driver just pass `lazy` option set to `true`, so all requests by default will be lazy:
```js
let readFileDriver = makeAsyncDriver({
  getResponse: request, callback) => {
    fs.readFile(requst.path, request.encoding || 'utf-8', callback)   
  },
  lazy: true
})
```

Or you can always override driver setting and make any request *lazy* (or *eager*) if required 
by adding `lazy: true` (or `lazy: false`) option to the request inside your app's logic:
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
