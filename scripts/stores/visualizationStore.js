'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var binsPromise = require('gramene-bins-client').promise;
var VisualizationActions = require('../actions/visualizationActions');

module.exports = Reflux.createStore({
  listenables: VisualizationActions,

  init: function() {
    this.listenTo(searchStore, this.updateBinState);
    binsPromise.get().then(this.initBinsGenerator);
  },

  updateBinState: function(searchState) {

  },

  initBinsGenerator: function(binsGenerator) {
    this.binsGenerator = binsGenerator;
  }

});
