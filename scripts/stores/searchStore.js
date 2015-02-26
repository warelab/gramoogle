'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var SearchActions = require('../actions/searchActions');

module.exports = Reflux.createStore({
  listenables: [SearchActions],
  getInitialState: function() { // TODO find out why it's idiomatic to use both an instance variable *and* react state for our state.
    if(!this.search) {
      this.search = { queryString: '', filters: {}, results: [], metadata: {} };
      // TODO populate results and metadata from server.
    }
    return this.search;
  },
  updateState: function(update) {
    _.assign(this.search, update);
  },

  // TODO remember to debounce async calls

  onSetQueryString: function(newQueryString) {
    console.log("New query term is", newQueryString);
    this.updateState({queryString: newQueryString});
  }
});