# cycle-async-driver
> Higher order factory for creating [cycle.js](http://cycle.js.org) async request/response drivers.

```bash
npm install cycle-async-driver -S
```

Allows you easily create **fully functional cycle.js driver** 
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

Async Driver factory.

- `getResponse` *(Function)*: function that takes `request` object as first param 
and `callback` as second param 
returns any kind of Promise or uses passed node style `callback` 
to give back async response for passed `request`. **required**
- `normalizeRequest` *(Function)*: function that will be applied to the request before handling.  
- `requestProp` *(String)*:  name of the property that will be attached to every response stream. *default value:* `request`
- `streamSource` *(Boolean)*: tells driver source to be directly a metastream of responses. *default value:* `false`

## Driver usage



### Error handling

Rxjs:
```js
let failure = (r$$) => r$$.map(r$ => r$.skip().catch(of))
let success = (r$$) => r$$.map(r$ => r$.catch(empty))
```
xstream:

```js
let failure = (r$$) => r$$.map(r$ => r$.drop().replaceError(xs.of))
let success = (r$$) => r$$.map(r$ => r$.replaceError(xs.empty))

```
#### Accessing response/request pairs
Sometimes you may find yourself in a need to access corresponding
response and request pairs, to do this follow such pattern:

```js    
  const pairMap = (res, req) => {res, req}
  
  let goodResReqPair$ = asyncDriver.select()
    .let(success)
    .map(r$ => r$.map(r => pairMap(r, r$.request)))
    .mergeAll()    
  
```

## Tests
```
npm install
npm run test
```
For running test in dev mode with watching `node-dev` should be installed globally (`npm i node-dev -g`) 
