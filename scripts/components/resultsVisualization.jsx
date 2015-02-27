'use strict';

var React = require('react');
//var SearchActions = require('../actions/searchActions');

var ResultsVisualization = React.createClass({

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