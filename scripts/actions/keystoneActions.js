'use strict';

var Reflux = require('reflux');

var KeystoneActions = Reflux.createActions([
  // use these when components become visible/invisible to specify what result types this component requires.
  'setKeystoneGene',
  'unsetKeystoneGene'
]);