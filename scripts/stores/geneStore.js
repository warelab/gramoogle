'use strict';

var Reflux = require('reflux');
var _ = require('lodash');

var GeneActions = require('../actions/geneActions');

var GeneStore = Reflux.createStore({
  listenables: GeneActions,
  init: function() {
    this.genes = {};
    this.trigger = _.debounce(this.trigger, 250);
  },
  needGeneDocCompleted: function (gene) {
    if(!this.genes[gene._id]) {
      console.log('needGeneCompleted new gene', gene);
      this.genes[gene._id] = gene;
      this.trigger(this.genes);
    }
    else {
      console.log('needGeneCompleted -- no changes');
    }
  },
  needGeneDocFailed: function (err) {
    console.log('needGeneFailed', err);
  },
  noLongerNeedGene: function (id) {
    console.log('noLongerNeedGene', id);
    delete this.genes[id];
  }
});

module.exports = GeneStore;