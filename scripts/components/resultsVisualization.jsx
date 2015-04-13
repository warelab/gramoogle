'use strict';

var React = require('react');
var Reflux = require('reflux');
var VisualizationActions = require('../actions/visActions');
var visualizationStore = require('../stores/visualizationStore');
var _ = require('lodash');

var Genome = React.createClass({
  propTypes: {
    genome: React.PropTypes.object.isRequired,
    hits: React.PropTypes.object.isRequired
  },
  render: function() {
    return (
      <li className="genome">{this.props.genome.taxon_id}</li>
    )
  }
});

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
    var thing, genomes;

    if(this.state.visData) {
      genomes = _.map(this.state.visData.binnedGenomes, function(genome) {
        return (
          <Genome ref={genome.taxon_id} genome={genome} hits={this.state.visData.binnedResults} />
        )
      }.bind(this));
      thing = (
        <div class="resultsVis">
          <p>{_.size(this.state.visData.binnedResults.data)} bins with
            stuff in them
          </p>
          <ol>
            {genomes}
          </ol>
        </div>
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
