'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var searchInterface = require('../libs/searchInterface');
var QueryActions = require('../actions/queryActions');

var resultTypes = require('../config/resultTypes');

module.exports = Reflux.createStore({
  listenables: QueryActions,

  init: function () {
    console.log('store init called');

    this.state = {
      query: {
        q: '',
        filters: {}, // fieldName => object of solr parameters
        resultTypes: {} // fieldName => object of solr parameters
      },
      results: {
        list: [],
        metadata: {}
      }
    };

    // make a copy of the query to keep with the results
    this.state.results.searchQuery = _.cloneDeep(this.state.query);

    this.search = _.debounce(this.search, 500);
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

  setQueryString: function (newQueryString) {
    console.log('setResultType', arguments);
    this.state.query.q = newQueryString;
    this.search();
  },

  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  search: function () {

    // make a copy of the query state when we make the async call
    // and use it as curried parameter for the checkDataAndAddQuery method
    var query = _.cloneDeep(this.state.query);
    var check = _.curry(checkDataAndAddQuery)(query);

    console.log('doing search', query);

    searchInterface.geneSearch(query)
      .then(check)
      .then(this.searchComplete)
      .catch(this.searchError);
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

function checkDataAndAddQuery(query, data) {
  _.forIn(query.resultTypes, function (params, key) {
    if (!data[key]) {
      console.error(key + ' not found in search results');
    }
  });

  data.searchQuery = query;

  return data;
}