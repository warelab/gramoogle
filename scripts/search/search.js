'use strict';

var Q = require('q');
var _ = require('lodash');

var searchCache = require('./searchInterfaceCache');
var searchInterface = require('gramene-search-client').client;

function checkRequestedResultTypesArePresent(data) {
  _.forIn(data.metadata.searchQuery.resultTypes,
    function (params, key) {
      if (!data[key]) {
        console.error(key + ' not found in search results');
      }
    });

  return data;
}

module.exports = {
  debounced: function(stateObj, searchComplete, searchError, time) {
    var func = function() {
      this.search(stateObj, searchComplete, searchError);
    }.bind(this);
    return _.debounce(func, time);
  },

  // Note that this function should probably be used via debounced.
  // It might be called many times in succession when a user is
  // interacting with the page, and then only the last one will fire.
  search: function (search, searchComplete, searchError) {
    // make a copy of the query state when we make the async call...
    var queryCopy = _.cloneDeep(search.query);

    console.log('performing search', queryCopy);

    // find cached results and move them from
    // query.resultTypes to query.cachedResultTypes
    searchCache.findCachedResults(queryCopy);

    // if we have any uncached result types, we need to
    // ask the server for some data, otherwise we will
    // just use what we have
    var promise;
    if(_.size(queryCopy.resultTypes) || !queryCopy.count) {
      promise = this.searchPromise(queryCopy)

        // when we get data from the server, put it in the
        // cache
        .then(searchCache.addResultsToCache(queryCopy))

        // and also add the query for the actual search
        // to the results metadata.
        .then(function addQueryToResults(data) {
          data.metadata.searchQuery = queryCopy;
          return data;
        });
    }
    else {
      promise = this.nullSearchPromise(queryCopy);
    }

    promise
      // add any cached data
      .then(searchCache.getResultsFromCache)

      // console.log for anything we asked for but didn't get
      // TODO should we error out here?
      .then(checkRequestedResultTypesArePresent)

      // tell interested parties about what has happened
      .then(searchComplete)
      .catch(searchError);
  },

  searchPromise: function(query) {
    console.log('asking search interface for', query);
    return searchInterface.geneSearch(query);
  },

  nullSearchPromise: function(query) {
    return Q.fcall(function refactorQueryToHaveShapeOfResponse() {
      console.log('remote query not required');
      var metadata = {searchQuery: query, count: query.count};
      return {metadata: metadata};
    });
  }
};