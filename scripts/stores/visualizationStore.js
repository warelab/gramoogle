'use strict';

var Reflux = require('reflux');
var binsPromise = require('gramene-bins-client').binsPromise;
var VisualizationActions = require('../actions/visualizationActions');
var searchStore = require('./searchStore');
var resultTypes = require('../config/resultTypes');
var QueryActions = require('../actions/queryActions');

function getFieldName(type, param) {
  return type ? type + '_' + param + '_bin' : undefined;
}

function getMethodName(type) {
  return type ? type + 'BinMapper' : undefined;
}

module.exports = Reflux.createStore({
  //listenables: VisualizationActions,

  init: function () {
    //this.listenTo(searchStore, this.updateBinState);
    //binsPromise.get().then(this.initBinsGenerator);
  },

  onRemoveDistribution: function(type, param) {
    this.onSetDistribution(); // set distribution to undefined
  },

  onSetDistribution: function (type, param) {
    var newFieldName = getFieldName(type, param);
    console.log('visStore will assemble distributions from field', newFieldName);

    if (this.fieldName) {
      if (this.fieldName !== newFieldName) {
        // don't need this data anymore.
        QueryActions.removeResultType(this.fieldName);
      }
      else {
        // we already have requested this distribution
        return;
      }
    }

    this.fieldName = newFieldName;
    this.binMapperMethodName = getMethodName(type);
    this.binMapperParam = param;

    if(!newFieldName) {
      this.trigger({});
      return;
    }

    this.possiblyInitBinnedGenomesAndTrigger();

    // notify that we would like this data please
    QueryActions.setResultType(
      this.fieldName,
      resultTypes.get(
        'distribution',
        {'facet.field': this.fieldName}
      )
    );
  },

  updateBinState: function (searchState) {
    this.binnedResults = searchState.results[this.fieldName];
    if(this.binnedResults) {
      console.log('visStore received new results');
      this.possiblyTrigger();
    }
    else {
      console.log('visStore did not receive data');
    }
  },

  initBinsGenerator: function (binsGenerator) {
    this.binsGenerator = binsGenerator;
    console.log('binsGenerator initialized');
    this.possiblyInitBinnedGenomesAndTrigger();
  },

  binnedGenomesIsUpToDate: function() {
    return this.binnedGenomes &&
      this.binnedGenomes.params.methodName == this.binMapperMethodName &&
      this.binnedGenomes.params.param == this.binMapperParam;
  },

  canInitBinnedGenomes: function() {
    return this.binsGenerator &&
      this.binMapperMethodName &&
      this.binMapperParam;
  },

  possiblyInitBinnedGenomesAndTrigger: function() {
    if (this.canInitBinnedGenomes() && !this.binnedGenomesIsUpToDate()) {
      var binFunction = this.binsGenerator[this.binMapperMethodName];
      this.binnedGenomes = binFunction(this.binMapperParam).binnedGenomes();
      this.binnedGenomes.params = { methodName: this.binMapperMethodName, param: this.binMapperParam };
      this.possiblyTrigger();
    }
  },

  haveNecessaryDataToTrigger: function() {
    return this.binnedGenomesIsUpToDate()
      && this.binnedResults;
  },

  possiblyTrigger: function () {
    // ensure binsGenerator, binMapperMethodName, binMapperParam and binResults populated
    if (this.haveNecessaryDataToTrigger()) {
      console.log('visStore triggering');
      this.trigger({ binnedGenomes: this.binnedGenomes, binnedResults: this.binnedResults });
    }
  }
});
