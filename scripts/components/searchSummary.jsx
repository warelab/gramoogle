'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;

var resultType = resultTypes.get('facet');

var FilterSummary = React.createClass({
  propTypes: {
    results: React.PropTypes.object.isRequired
  },
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
    <small>
      <div className="resultsCount"><strong>{metadata.count || 'loading…'}</strong> genes</div>
      <div><strong>{results.taxon_id ? results.taxon_id.count : 'loading…'}</strong> genomes</div>
    </small>
    );
  }
});
module.exports = FilterSummary;