'use strict';

var Reflux = require('reflux');
var searchInterface = require('../libs/searchInterface');

var SearchActions = Reflux.createActions({
  // use these when components become visible/invisible to specify what result types this component requires.
  'setResultType': {asyncResult: true},
  'removeResultType': {asyncResult: true},

  // queryString actions.
  'setQueryString': {asyncResult: true},

  // filter actions.
  'setFilter': {asyncResult: true},
  'removeFilter': {asyncResult: true}
});

//SearchActions.setFilter.listenAndPromise( searchInterface.geneSearch );
//SearchActions.removeFilter.listenAndPromise( searchInterface.geneSearch );
SearchActions.setQueryString.listenAndPromise( searchInterface.geneSearch );
SearchActions.setResultType.listenAndPromise( searchInterface.geneSearch );
SearchActions.removeResultType.listenAndPromise( searchInterface.geneSearch );

// this is equivalent to:
//searchAction.listen(function (queryString, filters) {
//  searchInterface.geneSearch(queryString, filters)
//    .then(searchAction.completed)
//    .catch(searchAction.error);
//});

module.exports = SearchActions;