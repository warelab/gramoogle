'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var searchInterface = require('gramene-search-client').client;
var QueryActions = require('../actions/queryActions');

module.exports = Reflux.createStore({
  listenables: QueryActions,

  init: function () {
    this.state = {
      query: {
        q: '',
        filters: {}, // fieldName => object of solr parameters
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

    this.search = _.debounce(this.searchNoDebounce, 500);
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

    // ...and use it as curried parameter for the stateless
    // checkDataAndAddQuery method
    var check = _.curry(checkDataAndAddQuery)(query);

    this.searchPromise(query)
      .then(check)
      .then(this.searchComplete)
      .catch(this.searchError);
  },

  searchPromise: function(query) {
    return searchInterface.geneSearch(query);
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

  data.metadata.searchQuery = query;

  return data;
}