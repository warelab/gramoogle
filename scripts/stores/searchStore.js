'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');
var searchInterface = require('gramene-search-client').client;
var QueryActions = require('../actions/queryActions');
var GrameneCache = require('gramene-client-cache');

module.exports = Reflux.createStore({
  listenables: QueryActions,

  init: function () {
    this.state = {
      query: {
        q: '',
        filters: {}, // filterKey => object of solr parameters
        resultTypes: {} // fieldName => object of solr parameters
      },
      results: {
        list: [],
        metadata: {},
        tally: {}
      }
    };

    // make a copy of the query to keep with the results
    this.state.results.metadata.searchQuery = _.cloneDeep(this.state.query);

    this.search = _.debounce(this.searchNoDebounce, 200);

    this.cache = GrameneCache.init(100);
  },

  getInitialState: function () {
    return this.state;
  },

  setResultType: function (fieldName, params) {
    console.log('setResultType', arguments);
    this.state.query.resultTypes[fieldName] = params;
    this.search();
  },

  removeResultType: function (fieldName) {
    console.log('removeResultType', arguments);
    delete this.state.query.resultTypes[fieldName];
    this.search();
  },

  setFilter: function(filter) {
    console.log('setFilter', arguments);
    this.state.query.filters[filter.fq] = filter;
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

  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  searchNoDebounce: function () {
    console.log('performing search', this.state.query);

    // make a copy of the query state when we make the async call...
    var query = _.cloneDeep(this.state.query);

    // find cached results and move them from
    // query.resultTypes to query.cachedResultTypes
    this.findCachedResults(query);

    // if we have any uncached result types, we need to
    // ask the server for some data, otherwise we will
    // just use what we have
    var promise;
    if(_.size(query.resultTypes) || !query.count) {
      promise = this.searchPromise(query)

        // when we get data from the server, put it in the
        // cache
        .then(this.addResultsToCache(query))

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
      .then(this.getResultsFromCache)

      // console.log for anything we asked for but didn't get
      // TODO should we error out here?
      .then(checkRequestedResultTypesArePresent)

      // tell interested parties about what has happened
      .then(this.searchComplete)
      .catch(this.searchError);
  },

  findCachedResults: function(query) {
    // get cached result count
    var countKey = {
      q: query.q,
      filters: query.filters
    };
    var count = this.cache.get(countKey);
    if(count !== undefined) {
      query.count = count;
    }

    // find result types with a cached result
    query.cachedResultTypes = _.omit(query.resultTypes, function(rt, name) {
      var key = _.assign({resultType: rt}, countKey);
      var cachedData = this.cache.get(key);
      if(cachedData) {
        rt.cachedResult = cachedData;
      }
      return !cachedData;
    }, this);

    query.resultTypes = _.omit(
      query.resultTypes,
      _.keys(query.cachedResultTypes)
    );

    console.log('cached results found', _.keys(query.cachedResultTypes))
    return query;
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

  getResultsFromCache: function(results) {
    _.forOwn(results.metadata.searchQuery.cachedResultTypes, function(rt, name) {
      results[name] = rt.cachedResult;
    });

    return results;
  },

  addResultsToCache: function(query) {
    return function (results) {
      // add count
      var countKey = {q: query.q, filters: query.filters};
      this.cache.set(countKey, results.metadata.count);

      // add result types
      _.forOwn(query.resultTypes, function(rt, rtName) {
        var key = _.assign({resultType: rt}, countKey);
        this.cache.set(key, results[rtName]);
      }, this);

      return results;
    }.bind(this);
  },

  searchComplete: function (results) {
    console.log('Got data: ', results);

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