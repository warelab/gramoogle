'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');
var QueryActions = require('../actions/queryActions');
var search = require('../search/search');

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

    this.search = search.debounced(
      this.state, // state object so search can access current query state
      this.searchComplete, // called when done
      this.searchError, // called on error
      200 // debounce time in ms
    );
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
