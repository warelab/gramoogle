'use strict';

var React = require('react');
var Reflux = require('reflux');
var queryActions = require('../actions/queryActions');
var VisualizationActions = require('../actions/visActions');
var visualizationStore = require('../stores/visualizationStore');
var _ = require('lodash');
var Vis = require('gramene-search-vis').Vis;

var ResultsVisualization = React.createClass({
  mixins: [
    Reflux.connect(visualizationStore, 'visData')
  ],
  getInitialState: function () {
    return {binWidth: 200, binType: 'fixed'};
  },
  componentWillMount: function () {
    VisualizationActions.setDistribution(this.state.binType, this.state.binWidth);
  },
  componentWillUnmount: function () {
    VisualizationActions.removeDistribution();
  },

  handleGeneSelection: function (bins) {
    console.log("handleGeneSelection",bins);
    VisualizationActions.selectRegion(bins);
  },

  handleTreeRootChange: function (newRoot, oldRoot) {
    console.log("handleTaxonomyRootChange",newRoot,oldRoot);
    // TODO: clobber other positive NCBITaxon_ancestors filters?
    queryActions.removeFilter({fq: 'NCBITaxon_ancestors:'+oldRoot.model.id});
    if (newRoot.id != "root/Eukaryota") {
      queryActions.setFilter({
        fq: 'NCBITaxon_ancestors:'+newRoot.model.id,
        category: 'Taxonomy',
        exclude: false,
        term: newRoot.model.name
      });
    }
  },
  
  handleSubtreeCollapse: function (taxonNode) {
    console.log("handleTaxonomySubtreeCollapse",taxonNode);
    queryActions.setFilter({
      fq: '-NCBITaxon_ancestors:'+taxonNode.model.id,
      category: 'Taxonomy',
      exclude: true,
      term: taxonNode.model.name
    });
  },

  handleSubtreeExpand: function (taxonNode) {
    console.log("handleTaxonomySubtreeExpand",taxonNode);
    queryActions.removeFilter({
      fq: '-NCBITaxon_ancestors:'+taxonNode.model.id,
    });
  },

  render: function () {
    var taxonomy, summary;

    if (this.state.visData) {
      taxonomy = this.state.visData.taxonomy;
      summary = (
        <div>
          <Vis
            taxonomy={taxonomy}
            onGeneSelection={this.handleGeneSelection}
            onSubtreeCollapse={this.handleSubtreeCollapse}
            onSubtreeExpand={this.handleSubtreeExpand}
            onTreeRootChange={this.handleTreeRootChange} />
        </div>
      );
    }
    else {
      summary = (
        <div>
          <p>Loading…</p>
        </div>
      );
    }

    return (
      <div className="resultsVis">
        {summary}
      </div>
    );
  }
});

module.exports = ResultsVisualization;
