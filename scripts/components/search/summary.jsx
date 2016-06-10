'use strict';

var React = require('react');
var QueryActions = require('../../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;
var _ = require('lodash');

var resultType = resultTypes.get('facet');

const LOADING_MESSAGE = 'loading…';

var Summary = React.createClass({
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
    var results, genes, species;
    results = this.props.results;
    genes = messageIfNotNumber(results, 'metadata.count', LOADING_MESSAGE);
    species = messageIfNotNumber(results, 'taxon_id.count', LOADING_MESSAGE);

    return (
    <div className="results-summary">
      <span className="gene-count"><strong>{genes}</strong> genes</span>
      <span className="join"> in </span>
      <span className="genomes-count"><strong>{species}</strong> genomes</span>
    </div>
    );
  }
});

function messageIfNotNumber(results, path, message) {
  var number = _.get(results, path);
  return _.isNumber(number) ? number : message;
}

module.exports = Summary;