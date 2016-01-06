'use strict';

var _ = require('lodash');

var mq;

if(window && window.matchMedia && _.isFunction(window.matchMedia)) {
  mq = function mq(q) {
    return window.matchMedia(q).matches;
  }
}
else {
  mq = function() { return undefined };
}

module.exports = {
  isLargeScreen: function() {
    return !mq("(max-width: 768px) OR (max-device-width: 960px)");
  }
};