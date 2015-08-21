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

function init(callback) {
  window.onhashchange = handleHashChangeFactory(callback);
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
  var result = expectedHash !== window.location.hash;
  console.log("Hash changed? ", result, expectedHash, window.location.hash);
  return result;
}

function queryFromHash() {
  return JSON.parse(decodeURI(window.location.hash.substring(1)));
}

function queryToHash(query) {
  expectedHash = '#' + encodeURI(JSON.stringify(query));
  window.location.hash = expectedHash;
}

module.exports = {
  init: init,
  persistQuery: queryToHash
};