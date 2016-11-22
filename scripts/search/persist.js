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
import getidListFromURLParams from './getidListFromURLParams';

let expectedSerializedHashState = '';
let expectedSerializedLocalStorageState = '';
const loc = global.location || {hash: expectedSerializedHashState};
const localStore = global.localStorage || {};

const maxLengthToShow = 3;

export function initUrlHashPersistence(callback) {
  var hashChangeHandler = handleHashChangeFactory(callback);
  possiblyCopyStateFromLocalStorage();
  global.onhashchange = hashChangeHandler;
  var idList = getidListFromURLParams();
  if (idList.length > 0) {
    var state = {filters: {}, taxa: {}};
    var fqString = 'id:(' + idList.join(' ') + ')';
    state.filters[fqString] = {
      category: "ID",
      display_name: idList.length <= maxLengthToShow ? idList.join(', ')
        : idList.slice(0,maxLengthToShow).join(', ') + ' and ' + (idList.length - maxLengthToShow) + ' more',
      exclude: false,
      fq: fqString
    };
    loc.hash = '#' + encodeURI(JSON.stringify(state));
  }
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
  expectedSerializedHashState = expectedSerializedHashState || loc.hash.substr(1);
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