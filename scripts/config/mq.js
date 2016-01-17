'use strict';

var _ = require('lodash');

var mq;

var mqs = {};

const SMALL_SCREEN_Q = "(max-device-width: 960px), (max-width: 768px)";

if(window && window.matchMedia && _.isFunction(window.matchMedia)) {
  mq = function mq(q) {
    var mm = mqs[q];
    if(!mm) {
      mm = mqs[q] = window.matchMedia(q);
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