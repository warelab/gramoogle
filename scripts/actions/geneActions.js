'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');

var geneCache = require('gramene-client-cache').init(1000);
var genesPromise = require('gramene-search-client').client.genes;

var GeneActions = Reflux.createActions({
  "needGeneDoc": {asyncResult: true},
  "noLongerNeedGeneDoc": {asyncResult: false}
});

GeneActions.needGeneDoc.listen(function (id) {
  console.log('GeneActions.needGeneDoc', id);

  if (!_.isString(id)) {
    throw new Error('id must be a string, you gave me a ' + typeof id);
  }

  var promise, cached;
  if ((cached = geneCache.get(id))) {
    promise = Q(cached);
  }
  else {
    geneCache.set(id, 'loading…');
    promise = genesPromise(id)
      .then(function checkForErrorsAndGetTheGene(response) {
        if (!response) {
          throw new Error('Got a falesy response from the API call');
        }
        if (!_.isArray(response.docs)) {
          throw new Error('Bad response from API: No docs');
        }
        if (!response.docs.length) {
          throw new Error('No docs back from API. Bad gene id?');
        }
        if (response.docs.length > 1) {
          throw new Error('Got more than one gene back. This is probably very bad.');
        }
        return response.docs[0];
      })
      .then(function addToCache(gene) {
        geneCache.set(id, gene);
        return gene;
      });
  }

  promise
    .then(this.completed)
    .catch(this.failed);
});

module.exports = GeneActions;