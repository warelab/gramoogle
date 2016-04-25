'use strict';

var React = require('react');
var Reflux = require('reflux');
var queryActions = require('../../actions/queryActions');
var VisualizationActions = require('../../actions/visActions');
var visualizationStore = require('../../stores/visualizationStore');
var _ = require('lodash');
var Vis = require('gramene-search-vis').Vis;
import Selection from './selection.jsx';

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

  handleSelection: function (selection) {
    this.setState({selection: selection});
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
    if (this.state.selection) {
      return <Selection taxonomy={this.state.visData.taxonomy}
                        selection={this.state.selection}/>
    }
  }

});

module.exports = ResultsVisualization;
