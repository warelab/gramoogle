'use strict';

var Reflux = require('reflux');

var VisualizationActions = Reflux.createActions([
  'setDistribution',
  'removeDistribution',
  'selectRegion'
]);

module.exports = VisualizationActions;