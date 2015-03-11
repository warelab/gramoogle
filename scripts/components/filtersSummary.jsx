'use strict';

var React = require('react');

var FilterSummary = React.createClass({
  render: function(){
    return (
        <p>{1 || this.props.metadata.count} genes in n genomes found in {1 || this.props.metadata.qtime}ms</p>
    );
  }
});
module.exports = FilterSummary;