'use strict';

var Reflux = require('reflux');

var SuggestActions = Reflux.createActions({
  // suggest or filter results based on user text input
  'filterFacet': {asyncResult: true}, // filter the list of facet results
  'provideSuggestions': {asyncResult: true} // suggest terms
});

exports = SuggestActions;