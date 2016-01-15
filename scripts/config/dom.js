'use strict';

var bodyEl;
if(document) {
  bodyEl = document.querySelector('body');
}

function getBodyClasses() {
  if(bodyEl) {
    return Array.prototype.slice.call(bodyEl.classList);
  }
}

function ensureBodyHasClass(name) {
  var classes = getBodyClasses();
  if(classes) {
    if(classes.indexOf(name) === -1) {
      classes.push(name);
      bodyEl.className = classes.join(' ');
    }
  }
}

function ensureBodyLacksClass(name) {
  var classes, idx;
  classes = getBodyClasses();
  if(classes) {
    idx = classes.indexOf(name);
    if(idx > -1) {
      classes.splice(idx, 1);
      bodyEl.className = classes.join(' ');
    }
  }
}

module.exports = {
  ensureBodyHasClass: ensureBodyHasClass,
  ensureBodyLacksClass: ensureBodyLacksClass
};