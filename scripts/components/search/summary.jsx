'use strict';

var React = require('react');
var QueryActions = require('../../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;
var _ = require('lodash');

import SummaryCount from "./SummaryCount.jsx";
import Spinner from "../Spinner.jsx";

var resultType = resultTypes.get('facet');

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
  render: function () {
    var results;
    results = this.props.results;

    // this only happens when the page is statically rendered during compile.
    if (_.size(results) === 0) {
      return (
          <div className="results-summary">
            <span>Initializing</span>
            <Spinner />
          </div>
      )
    }

    return (
        <div className="results-summary">
          <span className="gene-count"><SummaryCount results={results} path="metadata.count"/> genes</span>
          <span className="join"> in </span>
          <span className="genomes-count"><SummaryCount results={results} path="taxon_id.count"/> genomes</span>
        </div>
    );
  }
});

module.exports = Summary;