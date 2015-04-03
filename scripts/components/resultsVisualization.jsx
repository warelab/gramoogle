'use strict';

var React = require('react');
var Reflux = require('reflux');
var VisualizationActions = require('../actions/visualizationActions');
var visualizationStore = require('../stores/visualizationStore');
var _ = require('lodash');
var rgbHex = require('rgb-hex');

var ResultsVisualization = React.createClass({
  mixins: [
    Reflux.connect(visualizationStore, 'visData')
  ],
  getInitialState: function () {
    return {binWidth: 1000, binType: 'fixed'};
  },
  componentWillMount: function () {
    VisualizationActions.setDistribution(this.state.binType, this.state.binWidth);
    //QueryActions.setResultType(
    //  this.getFieldName(),
    //  this.getDistributionParameters()
    //);
  },
  componentWillUnmount: function () {
    VisualizationActions.removeDistribution(this.state.binType, this.state.binWidth);
  },

  render: function () {
    var thing;

    if(this.state.visData) {
      thing = (
        <p>{this.state.visData.binnedResults.ids.length} bins with stuff in them</p>
      );
    }
    else {
      thing = (
        <p>I would appreciate some binned data</p>
      );
    }

    return (
      <figure className="resultsVis">
        {thing}
        <img src="images/charlie.jpg" alt="Charlie Says…" />
        <figcaption>A Visualization</figcaption>
      </figure>
    );
  }
});

module.exports = ResultsVisualization;
