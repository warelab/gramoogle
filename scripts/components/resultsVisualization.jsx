'use strict';

var React = require('react');
var Reflux = require('reflux');
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

  render: function () {
    var taxonomy, summary;

    if(this.state.visData) {
      taxonomy = this.state.visData.taxonomy;
      summary = (
        <div>
          <p>{taxonomy.results().bins} of {taxonomy.binCount()} bins with
            stuff in them
          </p>
          <Vis taxonomy={taxonomy} />
        </div>
      );
    }
    else {
      summary = (
        <div>
          <p>I would appreciate some binned data</p>
          <img src="images/charlie.jpg" alt="Charlie Says…" />
          <figcaption>A Visualization</figcaption>
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
