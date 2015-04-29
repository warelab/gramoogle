'use strict';

var Reflux = require('reflux');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');
var searchInterface = require('gramene-search-client').client;
var SuggestActions = require('../actions/suggestActions');

module.exports = Reflux.createStore({
  init: function () {
    this.listenTo(QueryActions.setQueryString, this.provideSuggestions);

    this.suggest = _.debounce(this.suggestNoDebounce, 50);
  },

  provideSuggestions: function (queryString) {
    queryString = queryString.replace(/\s/g, '*');
    console.log('provideSuggestions', queryString);
    this.suggest(queryString);
  },


  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  suggestNoDebounce: function (queryString) {
    console.log('performing suggest', queryString);

    this.suggestPromise(queryString)
      .then(this.suggestComplete)
      .catch(this.suggestError);
  },

  suggestPromise: function(queryString) {
    return searchInterface.suggest(queryString);
  },

  suggestComplete: function (results) {
    console.log('Got data: ', results);
    this.trigger(results);
  },

  suggestError: function (error) {
    console.error('Error in suggest', error);
  }
});
