'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');

var ReactomeItem = React.createClass({
  propTypes: {
    reactomeItem: React.PropTypes.object.isRequired,
  },

  render: function() {
    var item = this.props.reactomeItem;

    return (
      <li className="reactome-item">
        <strong>{item.type}</strong>
        <p>{item.name}</p>
      </li>
    );
  }
});

module.exports = ReactomeItem;

