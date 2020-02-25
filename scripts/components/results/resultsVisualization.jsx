'use strict';

const React = require('react');
const Reflux = require('reflux');
const VisualizationActions = require('../../actions/visActions');
const visualizationStore = require('../../stores/visualizationStore');
const _ = require('lodash');
const Vis = require('gramene-search-vis').Vis;
import Selection from './selection.jsx';

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
    var summary;

    if (this.state.visData) {
      if (this.state.visData.taxonomy.model.results.count > 0) {
        summary = (
          <div>
            <Vis {...this.state.visData}
                 onSelection={this.handleSelection}
                 onHighlight={this.handleHighlight}/>
            {this.renderSelection()}
          </div>
        );
      }
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
    if (this.state.selections) {
      return <Selection {...this.state.visData}
                        selections={this.state.selections}/>
    }
  }

});

module.exports = ResultsVisualization;
