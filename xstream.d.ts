import {Stream, MemoryStream} from 'xstream';
import {StreamAdapter} from '@cycle/base';
import {XStreamAsyncSource} from './xstream-typings'
import {GetResponse, GetProgressiveResponse, ResponseStream} from './index.d.ts'

export function makeAsyncDriver<Response, Request>
  (getResponse: GetResponse<Request, Response>):  
  (sink$: Stream<Request>, runSA: StreamAdapter) => XStreamAsyncSource<Request, Response>

export function makeAsyncDriver
  <Request, Response>(
  params: {
    getResponse: GetResponse<Request, Response>
    lazy?: boolean
  }): 
  (sink$: Stream<Request>, runSA: StreamAdapter) => XStreamAsyncSource<Request, Response>

export function makeAsyncDriver
  <Request, Response>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<Request, Response>
    lazy?: boolean
  }):
  (sink$: Stream<Request>, runSA: StreamAdapter) => XStreamAsyncSource<Request, Response> 

export function makeAsyncDriver
  <Request, NormalizedRequest, Response>(
  params: {
    getResponse: GetResponse<NormalizedRequest, Response>
    normalizeRequest?(request: Request): NormalizedRequest,
    isolateMap?(request: Request): NormalizedRequest,
    lazy?: boolean
  }): 
  (sink$: Stream<Request>, runSA: StreamAdapter) => 
    XStreamAsyncSource<NormalizedRequest, Response>

export function makeAsyncDriver
  <Request, NormalizedRequest, Response>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<NormalizedRequest, Response>
    normalizeRequest?(request: Request): NormalizedRequest,
    isolateMap?(request: Request): NormalizedRequest,
    lazy?: boolean
  }): 
  (sink$: Stream<Request>, runSA: StreamAdapter) => 
    XStreamAsyncSource<NormalizedRequest, Response>