'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var resultTypes = require('../config/resultTypes');

var resultType = resultTypes.get('facet');

var FilterSummary = React.createClass({
  componentWillMount: function () {
    QueryActions.setResultType('taxon_id', resultType);
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType('taxon_id');
  },
  render: function(){
    var results = this.props.results;
    var metadata = results.metadata;

    return (
        <p>{metadata.count} genes in {results.taxon_id ? results.taxon_id.count : 'n'} genomes found in {metadata.qtime}ms</p>
    );
  }
});
module.exports = FilterSummary;