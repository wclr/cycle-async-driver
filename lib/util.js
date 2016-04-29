'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var isObservable = exports.isObservable = function isObservable(response$) {
  return typeof response$.subscribe === 'function';
};

var isPromise = exports.isPromise = function isPromise(response$) {
  return typeof response$.then === 'function';
};