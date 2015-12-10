'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');
var taxonomyPromise = require('gramene-trees-client').promise;

var LutStore = Reflux.createStore({
  init: function init() {
    this.state = {};

    taxonomyPromise.get().then(function addTaxonomyLut(taxonomy) {
      this.state.taxon = _.mapValues(taxonomy.indices.id, 'model.name');
      this.notify();
    }.bind(this));
  },
  notify: function notify() {
    this.trigger(this.state);
  }

});

module.exports = LutStore;