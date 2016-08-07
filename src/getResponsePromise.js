const isPromise = (p) => typeof p.then === 'function'

const getResponsePromise = (getResponse, request, abortCallback) => {
  let callbackResult
  let callbackPromise
  let handleCallback = () => {
    let {err, result} = callbackResult
    err ? callbackPromise.reject(err) : callbackPromise.resolve(result)
  }
  let callback = (err, result) => {
    callbackResult = {err, result}
    callbackPromise && handleCallback()
  }
  let res = getResponse(request, callback, abortCallback)
  if (res && isPromise(res)) {
    return res
  } else {
    return new Promise((resolve, reject) => {
      callbackPromise = {resolve, reject}
      callbackResult && handleCallback()
    })
  }
}

export default getResponsePromise
