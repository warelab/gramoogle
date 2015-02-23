'use strict';

var React = require('react');
var Charley = require('./charley.jsx');

var CharleyList = React.createClass({
  deleteCharley: function(index) {
    this.props.onDelete(index);
  },
  render: function() {
    var charlies = this.props.sayings.map(function(saying, index) {
      return (
        <li key={saying + index}><Charley what={saying} index={index} onDelete={this.deleteCharley} /></li>
      )
    }.bind(this));

    return (
      <ol>
         {charlies}
      </ol>
    );
  }
});

module.exports = CharleyList;
