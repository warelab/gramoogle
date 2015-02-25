'use strict';

var React = require('react');
var Charley = require('./charley.jsx');

var CharleyList = React.createClass({
  render: function() {
    var charlies = this.props.sayings.map(function(saying, index) {
      return (
        <li key={saying + index}><Charley what={saying} index={index} /></li>
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
