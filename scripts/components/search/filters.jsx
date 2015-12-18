'use strict';

var React = require('react');
var _ = require('lodash');

var Filter = require('./filter.jsx');

var Filters = React.createClass({
  propTypes: {
    filters: React.PropTypes.object.isRequired
  },
  render: function() {
    var filters = _.map(this.props.filters, function(term, fq) {
      var key = term.fq || term.category + '-' + term.display_name;
      return (
        <Filter key={key} term={term} />
      )
    });
    return (
      <ol className="list-inline search-filters">
        {filters}
      </ol>
    );
  }
});

module.exports = Filters;

