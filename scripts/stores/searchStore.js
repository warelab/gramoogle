'use strict';

/* @flow */

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');
var QueryActions = require('../actions/queryActions');
var search = require('../search/search');
var persist = require('../search/persist');

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

    // update query state from URL hash if it changes (e.g. back/fwd button press)
    persist.init(this.overwriteQueryState);

    // make a copy of the query to keep with the results
    this.state.results.metadata.searchQuery = _.cloneDeep(this.state.query);

    // hook up search from ../search/search.js.
    // search.js' debounce function would like a reference of this store's state so that
    // it can get an up-to-date query object, functions to use for success and failure
    // and a debounce time in ms.
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

  overwriteQueryState: function (newQuery) {
    this.state.query = newQuery;
    this.search();
  },

  setResultType: function (rtKey:string, params) {
    console.log('setResultType', arguments);
    this.state.query.resultTypes[rtKey] = params;
    this.search();
  },

  removeResultType: function (rtKey:string) {
    console.log('removeResultType', arguments);
    delete this.state.query.resultTypes[rtKey];
    this.search();
  },

  setFilter: function (filter) {
    console.log('setFilter', arguments);
    if (!this.state.query.filters.hasOwnProperty(filter.fq)) {
      this.state.query.filters[filter.fq] = filter;
      this.search();
    }
  },

  toggleFilter: function (filter) {
    console.log('toggleFilter', arguments);
    delete this.state.query.filters[filter.fq];
    if (filter.exclude) {
      filter.exclude = false;
      filter.fq = filter.fq.replace(/-/, '');
    }
    else {
      filter.exclude = true;
      filter.fq = '-' + filter.fq;
    }
    this.state.query.filters[filter.fq] = filter;
    this.search();
  },

  setAllFilters: function (filters) {
    console.log('setAllFilters', arguments);
    this.state.query.filters = filters;
    this.search();
  },

  removeFilter: function (filter) {
    console.log('removeFilter', arguments);
    if (this.state.query.filters.hasOwnProperty(filter.fq)) {
      delete this.state.query.filters[filter.fq];
      this.search();
    }
  },

  removeAllFilters: function () {
    console.log('removeAllFilters');
    this.setAllFilters({});
  },

  moreResults: function (howManyMore) {
    var listRt = this.state.query.resultTypes.list;
    if (listRt) {
      listRt.rows += howManyMore;
    }
    this.search();
  },

  searchComplete: function (results) {
    console.log('Got data: ', results);

    // update the URL hash
    persist.persistQuery(this.state.query);

    this.state.results = results;
    this.trigger(this.state);
  },

  searchError: function (error) {
    console.error('Error updating results', error);
  }
})
;
