
'use strict';

var Reflux = require('reflux');

var BackgroundSetActions = Reflux.createActions([
  // use these when components become visible/invisible to specify what result types this component requires.
  'setResultType',
  'removeResultType',
  'setTaxa'
]);

module.exports = BackgroundSetActions;