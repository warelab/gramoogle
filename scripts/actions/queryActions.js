'use strict';

var Reflux = require('reflux');

var QueryActions = Reflux.createActions([
  // use these when components become visible/invisible to specify what result types this component requires.
  'setResultType',
  'removeResultType',

  // queryString actions.
  'setQueryString',
  'removeQueryString',

  // filter actions.
  'setFilter',
  'setAllFilters',
  'removeFilter',
  'toggleFilter'
]);

module.exports = QueryActions;