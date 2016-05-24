'use strict';

var React = require('react');
var Reflux = require('reflux');
var VisualizationActions = require('../../actions/visActions');
var visualizationStore = require('../../stores/visualizationStore');
var _ = require('lodash');
var Vis = require('gramene-search-vis').Vis;
import Selections from './selection.jsx';

var ResultsVisualization = React.createClass({
  mixins: [
    Reflux.connect(visualizationStore, 'visData')
  ],
  getInitialState: function () {
    return {binWidth: 1000, binType: 'fixed'};
  },
  componentWillMount: function () {
    VisualizationActions.setDistribution(this.state.binType, this.state.binWidth);
  },
  componentWillUnmount: function () {
    VisualizationActions.removeDistribution();
  },

  handleSelection: function (selections) {
    this.setState({selections: selections});
  },

  handleHighlight: function (highlight) {
    this.setState({highlight: highlight});
  },

  render: function () {
    var taxonomy, summary;

    if (this.state.visData) {
      taxonomy = this.state.visData.taxonomy;
      summary = (
        <div>
          <Vis taxonomy={taxonomy}
               onSelection={this.handleSelection}
               onHighlight={this.handleHighlight}/>
          {this.renderSelection()}
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
      <div className="results-vis big-vis">
        {summary}
      </div>
    );
  },

  renderSelection() {
    if (this.state.selections && this.state.selections.length) {
      return <Selections taxonomy={this.state.visData.taxonomy}
                         selections={this.state.selections} />
    }
  },

});

module.exports = ResultsVisualization;
