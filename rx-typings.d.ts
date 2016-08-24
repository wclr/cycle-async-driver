import {Observable} from 'rx'
import {ResponseStream} from './index'

export interface RxAsyncSource<Request, Response> {  
  filter(predicate: (request: Request) => boolean): RxAsyncSource<Request, Response>
  select(category?: string): Observable<Observable<Response> & ResponseStream<Request>>
}
