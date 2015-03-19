'use strict';

var React = require('react');

var Result = React.createClass({
  render: function () {
    return (
      <li>
        <h4>{this.props.gene.name} <small>{this.props.gene.species}</small>
        </h4>
        <p>{this.props.gene.description}</p>
      </li>
    );
  }
});
module.exports = Result;