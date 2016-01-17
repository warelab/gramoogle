'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');

var Structure = React.createClass({
  propTypes: {
    domain: React.PropTypes.object.isRequired,
  },

  render: function() {
    var domain = this.props.domain;

    return (
      <li className="reactome-item">
        <strong>{item.type}</strong>
        <p>{item.name}</p>
      </li>
    );
  }
});

module.exports = Structure;

