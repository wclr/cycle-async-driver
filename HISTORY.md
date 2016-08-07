### v1.4.0     
    * Added successAll and failureAll helpers
    * select() without argument returns stream itself (to be compatible with future version)

### v1.3.0     
    * Added pull helper (two options: using new driver or using isolate mechanics)

### v1.2.0     
    * Added flatten helpers `success` and `failure`
    * Added default selector helper `select` with default `category` prop
    * Exports `attachHelpers` and other helper methods for extenal use

### v1.1.2
    * Use `normalizeRequest` in isolate if no `isolateMap`     

### v1.1.1
    * Added ability to create driver repsonse from callback and (native) Promise (`getResponse`)     
    * Added `makeAsyncDriver` (as recommended method), `createdDriver` stays
    * Added `responseProp`

### v1.0.0
    * Basic API via `createDriver` method