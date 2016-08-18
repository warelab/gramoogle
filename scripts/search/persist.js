/*
persist.js

Maintain query state outside of JS memory. Currently this module simply keeps it in
sync with the URL hash. It is used in searchStore.js and probably won't work anywhere
else. It is in a separate file basically to enhance readability of code.

It could be refactored to "persistStore", and listen for "PersistAction"
 messages. searchStore would listen to it.

This module is likely to be replaced if/when we refactor the codebase to use React Router.
*/

import _ from 'lodash';

let expectedSerializedHashState = '';
let expectedSerializedLocalStorageState = '';
const loc = global.location || {hash: expectedSerializedHashState};
const localStore = global.localStorage || {};

export function initUrlHashPersistence(callback) {
  var hashChangeHandler = handleHashChangeFactory(callback);
  possiblyCopyStateFromLocalStorage();
  global.onhashchange = hashChangeHandler;
  hashChangeHandler();
}

/* copy query state from local storage if a hash is not present on the url */
function possiblyCopyStateFromLocalStorage() {
  if(localStore.persist && !loc.hash) {
    loc.hash = localStore.persist;
  }
}

function handleHashChangeFactory(callback) {
  return function handleHashChange() {
    if (hashDidChange()) {
      console.log("Got updated query state from hash.");
      callback(stateFromHash());
    }
  }
}

function hashDidChange() {
  var result = ('#' + expectedSerializedHashState) !== loc.hash;
  console.info("Hash changed? ", result, expectedSerializedHashState, loc.hash);
  return result;
}

function stateFromHash() {
  var hashVal = loc.hash ? loc.hash.substring(1) : '';
  return hashVal ? JSON.parse(decodeURI(hashVal)) : {};
}

export function persistState(state) {
  persistToHash(state);
  persistToLocalStorage(state);
}

function persistToHash(state) {
  expectedSerializedHashState = _.isEmpty(state) ? '' : '#' + encodeURI(JSON.stringify(state));

  if(loc.hash !== expectedSerializedHashState) {
    loc.hash = expectedSerializedHashState;
  }
}

function persistToLocalStorage(state) {
  const genomes = _.pick(state, 'taxa');

  expectedSerializedLocalStorageState = _.isEmpty(genomes) ? '' : '#' + JSON.stringify(genomes);
  if(localStore.persist !== expectedSerializedLocalStorageState) {
    localStore.persist = expectedSerializedLocalStorageState;
  }
}