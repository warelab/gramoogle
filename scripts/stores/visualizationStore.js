'use strict';

var Reflux = require('reflux');
var Q = require('q');
var taxonomy = require('gramene-taxonomy-with-genomes');
var VisualizationActions = require('../actions/visActions');
var searchStore = require('./searchStore');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../actions/queryActions');

module.exports = Reflux.createStore({
  listenables: VisualizationActions,

  init: function () {
    this.listenTo(searchStore, this.updateBinState);
    taxonomy.get().then(this.initBinsGeneratorAndSpeciesTree);
  },

  onSelectRegion: function(bins) {
    var taxon_id = bins.start.taxon_id;
    var taxNode = this.taxonomy.indices.id[taxon_id];
    var species = taxNode.name;
    var binField = this.taxonomy.binParams.method + '_' + this.taxonomy.binParams.param + '__bin';
    var binRange = bins.start.region === 'UNANCHORED'
      ? bins.start.region
      : bins.start.region + ':' + bins.start.start + '-' + bins.end.end;
    QueryActions.setFilter({
      category: 'Region',
      display_name: species + ' ' + binRange,
      exclude: false,
      fq: binField+ ':[' + bins.start.idx + ' TO ' + bins.end.idx + ']'
    });
  },

  onRemoveDistribution: function() {
    this.onSetDistribution(); // set distribution to undefined
  },

  onSetDistribution: function (type, param) {
    var newFieldName = getFieldName(type, param);
    console.log('visStore will assemble distributions from field',
      newFieldName);

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

    this.binMapperType = type;
    this.binMapperParam = param;

    this.fieldName = newFieldName;

    this.possiblyInitBinnedGenomesAndTrigger();

    // notify that we would like this data please
    if(this.fieldName) {
      QueryActions.setResultType(
        this.fieldName,
        resultTypes.get(
          'distribution',
          {'facet.field': this.fieldName}
        )
      );
    }
  },

  updateBinState: function (searchState) {
    this.binnedResults = searchState.results[this.fieldName];
    this.selectedTaxa = searchState.global.taxa;
    
    if(this.binnedResults) {
      console.log('visStore received new results');
      this.possiblyTrigger();
    }
    else {
      console.log('visStore did not receive data');
    }
  },

  initBinsGeneratorAndSpeciesTree: function (taxonomy) {
    this.taxonomy = taxonomy;
    this.possiblyInitBinnedGenomesAndTrigger();
  },

  canInitBinnedGenomes: function() {
    return this.taxonomy &&
      this.binMapperType &&
      this.binMapperParam;
  },

  possiblyInitBinnedGenomesAndTrigger: function() {
    if(!this.fieldName) {
      this.taxonomy.removeBins();
      this.trigger({taxonomy: this.taxonomy});
    }

    else if (this.canInitBinnedGenomes()) {
      this.taxonomy.setBinType(this.binMapperType, this.binMapperParam);
      this.possiblyTrigger();
    }
  },

  haveNecessaryDataToTrigger: function() {
    return this.taxonomy &&
      this.taxonomy.binParams.method &&
      this.binnedResults;
  },

  possiblyTrigger: function () {
    // ensure binsGenerator, binMapperMethodName,
    // binMapperParam and binResults populated
    if (this.haveNecessaryDataToTrigger()) {
      this.taxonomy.setResults(this.binnedResults);

      console.log('visStore triggering');
      this.trigger({
        taxonomy: this.taxonomy,
        selectedTaxa: this.selectedTaxa
      });
    }
  }
});

function getFieldName(type, param) {
  return type ? type + '_' + param + '__bin' : undefined;
}