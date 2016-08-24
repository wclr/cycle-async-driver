import {StreamAdapter} from '@cycle/base';

interface ResponseStream<Request> {
    request: Request;
}

export type GetResponseCallback<Response> = (err: any, response?: Response) => any

export type GetResponse<Request, Response> = (
  request: Request,
  callback: GetResponseCallback<Response>,
  disposeCallback: any
) => any

export type GetProgressiveResponseObserver<Response> = { err: any, next: any, complete: any }

export type GetProgressiveResponse<Request, Response> = (
  request: Request,
  observer: GetProgressiveResponseObserver<Response>,
  disposeCallback: any
) => any

export function makeAsyncDriver<Request, Response, DriverSource>
  (getResponse: GetResponse<Request, Response>): 
  (sink$: any, runSA: any) => DriverSource

export function makeAsyncDriver
  <Request, Response, DriverSource>(
  params: {
    getResponse: GetResponse<Request, Response>
    lazy?: boolean
  }): 
  (sink$: any, runSA: StreamAdapter) => DriverSource

export function makeAsyncDriver
  <Request, Response, DriverSource>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<Request, Response>
    lazy?: boolean
  }): 
  (sink$: any, runSA: StreamAdapter) => DriverSource

export function makeAsyncDriver
  <Request, NormalizedRequest, Response, DriverSource>(
  params: {
    getResponse: GetResponse<NormalizedRequest, Response>
    normalizeRequest?(request: Request): NormalizedRequest,
    isolateMap?(request: Request): NormalizedRequest,
    lazy?: boolean
  }): 
  (sink$: any, runSA: StreamAdapter) => DriverSource

export function makeAsyncDriver
  <Request, NormalizedRequest, Response, DriverSource>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<NormalizedRequest, Response>
    normalizeRequest?(request: Request): NormalizedRequest,
    isolateMap?(request: Request): NormalizedRequest,
    lazy?: boolean
  }): 
  (sink$: any, runSA: StreamAdapter) => DriverSource
