'use strict';

/* @flow */
type map = { [key: string]: any };

var Q = require('q');
var _ = require('lodash');

var searchCache = require('./searchInterfaceCache');
var searchInterface = require('gramene-search-client').client;

function checkRequestedResultTypesArePresent(data: map): map {
  _.forIn(data.metadata.searchQuery.resultTypes,
    function (params, key) {
      if (!data[key]) {
        console.error(key + ' not found in search results');
      }
    });

  return data;
}

function prepFilters(filters: map): map {
  var newFilters = {};
  var fieldValues = {};
  var suggestCategoryField = {};
  for (var fq in filters) {
    var fqMetadata = filters[fq];
    if (fqMetadata.exclude) {
      newFilters[fq] = {};
    }
    else {
      var fv = fq.split(':');
      var field = fv[0];
      var suggestCategory = fqMetadata.category;
      var value = fv[1];
      suggestCategoryField[suggestCategory] = field;
      if (!fieldValues.hasOwnProperty(suggestCategory)) {
        fieldValues[suggestCategory] = [];
      }
      fieldValues[suggestCategory].push(value);
    }
  }
  for (var suggestCategory in fieldValues) {
    var field = suggestCategoryField[suggestCategory];
    newFilters[field+':'+'('+fieldValues[suggestCategory].join(' ')+')'] = {};
  }
  console.log('prepFilters',filters,newFilters);
  return newFilters;
}

module.exports = {
  debounced: function(stateObj: map, searchComplete: Function, searchError: Function, time: number): Function {
    var func = function() {
      this.search(stateObj, searchComplete, searchError);
    }.bind(this);
    return _.debounce(func, time);
  },

  // Note that this function should probably be used via debounced.
  // It might be called many times in succession when a user is
  // interacting with the page, and then only the last one will fire.
  search: function (search: map, searchComplete: Function, searchError: Function): void {
    // make a copy of the query state when we make the async call...
    var queryCopy = _.cloneDeep(search.query);

    if (queryCopy.filters) {
      queryCopy.filters = prepFilters(queryCopy.filters);
    }

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

  searchPromise: function(query: map): Promise {
    console.log('asking search interface for', query);
    return searchInterface.geneSearch(query);
  },

  nullSearchPromise: function(query: map): map {
    return Q.fcall(function refactorQueryToHaveShapeOfResponse() {
      console.log('remote query not required');
      var metadata = {searchQuery: query, count: query.count};
      return {metadata: metadata};
    });
  }
};
