'use strict';

var React = require('react');
var Reflux = require('reflux');
var VisualizationActions = require('../actions/visActions');
var visualizationStore = require('../stores/visualizationStore');
var _ = require('lodash');

var Genome = React.createClass({
  propTypes: {
    species: React.PropTypes.object.isRequired
  },
  render: function() {
    return (
      <li className="genome">{this.props.species.name}</li>
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
    var thing, taxonomy, genomes;

    if(this.state.visData) {
      taxonomy = this.state.visData.taxonomy;
      genomes = taxonomy.speciesWithResults().map(function(species) {
        return (
          <Genome key={species.id} species={species} />
        );
      });
      thing = (
        <div className="resultsVis">
          <p>{taxonomy.results().bins} of {taxonomy.binCount()} bins with
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
