import {Stream, MemoryStream} from 'xstream';
import {ResponseStream} from './index'

export interface XStreamAsyncSource<Request, Response> {  
  filter(predicate: (request: Request) => boolean): XStreamAsyncSource<Request, Response>
  select(category?: string): Stream<MemoryStream<Response> & ResponseStream<Request>>
}
