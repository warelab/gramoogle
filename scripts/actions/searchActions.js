'use strict';

var Reflux = require('reflux');
var searchInterface = require('../libs/searchInterface');

var SearchActions = Reflux.createActions({
  'setQueryString': {},
  'search': {asyncResult: true}
});

SearchActions.search.listenAndPromise( searchInterface.geneSearch );

// this is equivalent to:
//searchAction.listen(function (queryString, filters) {
//  searchInterface.geneSearch(queryString, filters)
//    .then(searchAction.completed)
//    .catch(searchAction.error);
//});

module.exports = SearchActions;