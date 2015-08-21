/*
persist.js

Maintain query state outside of JS memory. Currently this module simply keeps it in
sync with the URL hash. It is used in searchStore.js and probably won't work anywhere
else. It is in a separate file basically to enhance readability of code.

It could be refactored to "persistStore", and listen for "PersistAction"
 messages. searchStore would listen to it.

This module is likely to be replaced if/when we refactor the codebase to use React Router.
*/

var _ = require('lodash');

var expectedHash = '#';
var loc = window.location;

function init(callback) {
  var hashChangeHandler = handleHashChangeFactory(callback);
  window.onhashchange = hashChangeHandler;
  hashChangeHandler();
}

function handleHashChangeFactory(callback) {
  return function handleHashChange() {
    if (hashDidChange()) {
      console.log("Got updated query state from hash.");
      callback(queryFromHash());
    }
  }
}

function hashDidChange() {
  var result = expectedHash !== loc.hash;
  console.debug("Hash changed? ", result, expectedHash, loc.hash);
  return result;
}

function queryFromHash() {
  return JSON.parse(decodeURI(loc.hash.substring(1)));
}

function queryToHash(query) {
  expectedHash = '#' + encodeURI(JSON.stringify(query));
  if(loc.hash !== expectedHash) {
    loc.hash = expectedHash;
  }
}

module.exports = {
  init: init,
  persistQuery: queryToHash
};