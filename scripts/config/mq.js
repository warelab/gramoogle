'use strict';

var _ = require('lodash');

var mq;

var mqs = {};

const SMALL_SCREEN_Q = "(max-device-width: 767px), (max-width: 767px)";

if(global && global.matchMedia && _.isFunction(global.matchMedia)) {
  mq = function mq(q) {
    var mm = mqs[q];
    if(!mm) {
      mm = mqs[q] = global.matchMedia(q);
    }
    return mm;
  }
}
else {
  mq = function() { return undefined };
}

module.exports = {
  isLargeScreen: function() {
    return !mq(SMALL_SCREEN_Q).matches;
  }
};