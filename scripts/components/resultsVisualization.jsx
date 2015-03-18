'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var resultTypes = require('../config/resultTypes');

var ResultsVisualization = React.createClass({
  getInitialState: function() {
    return { binWidth: '10Mb'};
  },
  getFieldName: function() {
    return 'bin_' + this.state.binWidth;
  },
  getDistributionParameters: function() {
    var fieldName = this.getFieldName();
    return resultTypes.get(
      'distribution',
      {'facet.field': fieldName}
    );
  },
  componentWillMount: function() {
    QueryActions.setResultType(
      this.getFieldName(),
      this.getDistributionParameters()
    );
  },
  componentWillUnmount: function() {
    QueryActions.removeResultType(this.getFieldName());
  },

  render: function(){
    return (
      <figure className="vis">
        <img src="images/charlie.jpg" alt="Charlie Says…" />
        <figcaption>A Visualization</figcaption>
      </figure>
    );
  }
});
module.exports = ResultsVisualization;