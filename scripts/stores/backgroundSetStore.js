'use strict';

/* @flow */

var Reflux = require('reflux');
var _ = require('lodash');
var backgroundSetActions = require('../actions/backgroundSetActions');
var search = require('../search/search');

module.exports = Reflux.createStore({
  listenables: [backgroundSetActions],

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
      },
      global: {
        taxa: {} // key is taxon_id, value should be entry in taxonomy object
        // taxa: {3702:'ath',4577:'zm',39947:'o.sat', 15368: 'brachy', 3847: 'g.max'} // key is taxon_id, value should
        // be entry in taxonomy object
      }
    };

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

  setTaxa: function (taxa) {
    this.state.query.q = `{!terms f=taxon_id}${taxa.join(',')}`;
    this.search();
  },

  searchComplete: function (results) {
    // console.log('Got data: ', results);
    this.state.results = results;
    this.trigger(this.state);
  },

  searchError: function (error) {
    console.error('Error updating results', error.stack, error);
  }
});
