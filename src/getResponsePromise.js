const isPromise = (p) => typeof p.then === 'function'

const getResponsePromise = (getResponse, request) => {
  let p
  let promise = new Promise((resolve, reject) => {
    p = {resolve, reject}
  })
  let callback = (err, result) => {
    err ? p.reject(err) : p.resolve(result)
  }
  let res = getResponse(request, callback)
  if (res && isPromise(res)) {

    promise = res
  }
  return promise
}

export default getResponsePromise