'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');

var QueryTerm = React.createClass({
  propTypes: {
    category: React.PropTypes.string,
    name: React.PropTypes.string.isRequired,
    count: React.PropTypes.number,
    handleClick: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return { hidden: false };
  },
  applyFilter: function() {
    this.props.handleClick();
    this.setState({ hidden: true });
  },
  render: function() {
    var className, category, name, badge;

    if(this.props.category) {
      category = this.props.category + ' | ';
    }
    name = this.props.name;
    className = "query-term";

    if(this.state.hidden) {
      className += " hidden";
    }

    if(_.isNumber(this.props.count)) {
      badge = <bs.Badge bsStyle="warning">{this.props.count}</bs.Badge>
    }

    return (
      <div onClick={this.applyFilter} className={className}>
        {category}
        <a onClick={this.applyFilter}>{name}</a>
        {badge}
      </div>
    );
  }
});

module.exports = QueryTerm;