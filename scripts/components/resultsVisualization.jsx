'use strict';

var React = require('react');
var SearchActions = require('../actions/searchActions');
var resultTypes = require('../config/resultTypes');

var ResultsVisualization = React.createClass({
  componentWillMount: function() {
    SearchActions.setResultType('distribution', resultTypes.get('distribution'));
  },
  componentWillUnmount: function() {
    SearchActions.removeResultType('distribution');
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