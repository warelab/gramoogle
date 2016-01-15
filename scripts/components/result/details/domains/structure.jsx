'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');

var Structure = React.createClass({
  propTypes: {
    translation: React.PropTypes.object.isRequired,
  },

  render: function() {
    var translation = this.props.translation;

    return (
      <li className="domain-list">

      </li>
    );
  }
});

module.exports = Structure;

