'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var resultTypes = require('../config/resultTypes');

var resultType = resultTypes.get('facet');

var FilterSummary = React.createClass({
  componentWillMount: function () {
    QueryActions.setResultType('species', resultType);
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType('species');
  },
  render: function(){
    var results = this.props.results;
    var metadata = results.metadata;

    return (
        <p>{metadata.count} genes in {results.species ? results.species.length : 'n'} genomes found in {metadata.qtime}ms</p>
    );
  }
});
module.exports = FilterSummary;