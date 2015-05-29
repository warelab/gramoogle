'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');
var searchInterface = require('gramene-search-client').client;
var QueryActions = require('../actions/queryActions');
var searchCache = require('../search/searchInterfaceCache');

module.exports = Reflux.createStore({
  listenables: QueryActions,

  init: function () {
    this.state = {
      query: {
        q: '',
        filters: {}, // filterKey => object of solr parameters
        resultTypes: {} // key || fieldName => object of solr parameters
      },
      results: {
        list: [],
        metadata: {},
        tally: {}
      }
    };

    // TODO use react-router
    if(window && window.location.hash) {
      this.state.query = JSON.parse(decodeURI(window.location.hash.substring(1)));
    }

    // make a copy of the query to keep with the results
    this.state.results.metadata.searchQuery = _.cloneDeep(this.state.query);

    this.search = _.debounce(this.searchNoDebounce, 200);
  },

  getInitialState: function () {
    return this.state;
  },

  setResultType: function (rtKey, params) {
    console.log('setResultType', arguments);
    this.state.query.resultTypes[rtKey] = params;
    this.search();
  },

  removeResultType: function (rtKey) {
    console.log('removeResultType', arguments);
    delete this.state.query.resultTypes[rtKey];
    this.search();
  },

  setFilter: function(filter) {
    console.log('setFilter', arguments);
    this.state.query.filters[filter.fq] = filter;
    this.search();
  },

  setAllFilters: function(filters) {
    console.log('setAllFilters', arguments);
    this.state.query.filters = filters;
    this.search();
  },

  removeFilter: function(filter) {
    console.log('removeFilter', arguments);
    delete this.state.query.filters[filter.fq];
    this.search();
  },

  setQueryString: function (newQueryString) {
    console.log('setQueryString', arguments);
    this.state.query.q = newQueryString;
    this.search();
  },

  removeQueryString: function() {
    console.log('removeQueryString');
    this.state.query.q = '';
    this.search();
  },

  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  searchNoDebounce: function () {
    console.log('performing search', this.state.query);

    // make a copy of the query state when we make the async call...
    var query = _.cloneDeep(this.state.query);

    // find cached results and move them from
    // query.resultTypes to query.cachedResultTypes
    searchCache.findCachedResults(query);

    // if we have any uncached result types, we need to
    // ask the server for some data, otherwise we will
    // just use what we have
    var promise;
    if(_.size(query.resultTypes) || !query.count) {
      promise = this.searchPromise(query)

        // when we get data from the server, put it in the
        // cache
        .then(searchCache.addResultsToCache(query))

        // and also add the query for the actual search
        // to the results metadata.
        .then(function addQueryToResults(data) {
          data.metadata.searchQuery = query;
          return data;
        });
    }
    else {
      promise = this.nullSearchPromise(query);
    }

    promise
      // add any cached data
      .then(searchCache.getResultsFromCache)

      // console.log for anything we asked for but didn't get
      // TODO should we error out here?
      .then(checkRequestedResultTypesArePresent)

      // tell interested parties about what has happened
      .then(this.searchComplete)
      .catch(this.searchError);
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
  },

  searchComplete: function (results) {
    console.log('Got data: ', results);

    window.location.hash = encodeURI(JSON.stringify(this.state.query));

    // TODO: compare query state used for search with the current one
    this.state.results = results;

    this.trigger(this.state);
  },

  searchError: function (error) {
    console.error('Error updating results', error);
  }
});

function checkRequestedResultTypesArePresent(data) {
  _.forIn(data.metadata.searchQuery.resultTypes,
      function (params, key) {
    if (!data[key]) {
      console.error(key + ' not found in search results');
    }
  });

  return data;
}