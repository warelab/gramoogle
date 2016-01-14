'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');

var docCache = require('gramene-client-cache').init(1000);
var client = require('gramene-search-client').client;

var DocActions = Reflux.createActions({
  "needDocs": {asyncResult: true},
  "noLongerNeedDocs": {asyncResult: false}
});

function getClientPromise(collection) {
  if (
    _.isString(collection) &&
    !(
      _.has(client, collection)
      && collection !== '_testSearch'
      && collection !== 'grameneClient'
      && collection !== 'validate'
      && collection !== 'suggest'
      && collection !== 'geneSearch'
    ))
  {
    throw new Error("Illegal collection: " + collection);
  }

  return client[collection];
}

DocActions.needDocs.listen(function (collection, id) {
  var cacheKey, clientCall;
  cacheKey = [collection,id];
  console.log('DocActions.needDocs', collection, id);

  clientCall = getClientPromise(collection);

  if (!(_.isString(id) || _.isArray(id))) {
    throw new Error('id must be a string or array, you gave me a ' + typeof id);
  }

  var promise, cached;
  if ((cached = docCache.get(cacheKey))) {
    promise = Q(cached);
  }
  else {
    docCache.set(id, 'loading…');
    promise = clientCall(id)
      .then(function checkForErrorsAndGetTheDocs(response) {
        if (!response) {
          throw new Error('Got a falesy response from the API call');
        }
        if (!_.isArray(response.docs)) {
          throw new Error('Bad response from API: No docs');
        }
        if (!response.docs.length) {
          throw new Error('No docs back from API. Bad doc id?');
        }
        if(_.isString(id)) {
          if (response.docs.length > 1) {
            throw new Error('Got more than one doc back. This is probably very bad.');
          }
        }
        return { collection: collection, docs: response.docs };
      })
      .then(function addToCache(docs) {
        docCache.set(cacheKey, docs);
        return docs;
      });
  }

  promise
    .then(this.completed)
    .catch(this.failed);
});

module.exports = DocActions;