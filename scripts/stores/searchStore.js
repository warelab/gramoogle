'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var SearchActions = require('../actions/searchActions');

module.exports = Reflux.createStore({
  listenables: [SearchActions],
  getInitialState: function () { // TODO find out why it's idiomatic to use both an instance variable *and* react state for our state.
    if (!this.search) {
      this.search = {
        queryString: '',
        filters: {},
        results: [],
        metadata: {
          count: 0,
          qtime: 0
        },
        updating: false
      };

      SearchActions.search(this.search.queryString, this.search.filters);
    }
    return this.search;
  },

  search: function() {
    console.log('called when async call made');
    return false;
    // TODO does return false stop the call being made?
  },

  searchCompleted: function(data) {
    console.log('called on success of search async call', data);
    //this.search.queryString = queryString;
    //this.search.filters = filters;
    //this.search.results = results.response.docs;
    //this.search.metadata.count = results.response.numFound;
    //this.search.metadata.qtime = results.responseHeader.QTime;
    //this.search.updating = false;
  },

  searchFailed: function(error) {
    console.log('called when error in async call', error);
  },

  onSetQueryString: function (newQueryString) {
    //this.performSearch(newQueryString, this.search.filters);
    if(newQueryString !== this.search.queryString)
    {
      SearchActions.search(newQueryString, this.search.filters);
    }
  }
});