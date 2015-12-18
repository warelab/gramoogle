'use strict';

var React = require('react');
var Reflux = require('reflux');
var QueryActions = require('../../actions/queryActions');
var _ = require('lodash');

var Glyphicon = require('react-bootstrap').Glyphicon;

var Filter = React.createClass({
  propTypes: {
    term: React.PropTypes.object.isRequired
  },
  removeFilter: function() {
    QueryActions.removeFilter(this.props.term);
  },
  toggleFilter: function() {
    QueryActions.toggleFilter(this.props.term);
  },
  render: function() {
    var term = this.props.term;
    var thumb = term.exclude ? 'exclude' : 'include';
    return (
      <li className="search-filter">
        {term.category} |&nbsp;
        <a className={thumb} onClick={this.toggleFilter}>{term.display_name}</a> &nbsp;
        <a onClick={this.removeFilter}><Glyphicon glyph='remove' /></a>
      </li>
    );
  }
});

module.exports = Filter;