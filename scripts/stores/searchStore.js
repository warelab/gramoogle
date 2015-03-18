'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var SearchActions = require('../actions/searchActions');

var resultTypes = require('../config/resultTypes');

module.exports = Reflux.createStore({
  init: function() {
    console.log('store init called');

    for(var actionName in SearchActions) {
      var action = SearchActions[actionName];
      var listenerName = 'updateResults';

      // listen to the child methods (ie of async actions)
      if(action.children.length) {
        this.listenTo(action, listenerName);
        this.listenTo(action.completed, listenerName + 'Complete');
        this.listenTo(action.failed, listenerName + 'Error');
      }
    }

    SearchActions.setQueryString.preEmit = function(queryString) {
      var queryState = this.cloneQueryState();
      queryState.q = queryString;
      return queryState;
    }.bind(this);

    SearchActions.setResultType.preEmit = function(typeName, resultType) {
      var queryState = this.cloneQueryState();
      queryState.resultTypes[typeName] = resultType;
      return queryState;
    }.bind(this);

    SearchActions.removeResultType.preEmit = function(typeName) {
      var queryState = this.cloneQueryState();
      delete queryState.resultTypes[typeName];
      return queryState;
    }.bind(this);

  },

  getInitialState: function () {
    if (!this.searchState) {
      this.searchState = {
        query: {
          q: '*',
          filters: {}, // identifiable key => object of solr parameters
          resultTypes: { list: resultTypes.get('list') }
        },
        // N.B. the keys for resultTypes and results should match
        results: {}
      };
    }
    return this.searchState;
  },

  cloneQueryState: function() {
    return _.cloneDeep(this.searchState.query);
  },

  updateResults: function() {
    console.log('Async call to solr to update results is happening now');
  },

  updateResultsComplete: function(response) {
    console.log('Got data: ', response);
    // TODO: update state
  },

  updateResultsError: function(error) {
    console.error('Error updating results', error);
  }
});