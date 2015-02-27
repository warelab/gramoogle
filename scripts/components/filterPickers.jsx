'use strict';

var React = require('react');
//var SearchActions = require('../actions/searchActions');

var FilterPickers = React.createClass({
  render: function() {
    return (
      <ol>
        <li>Detailed</li>
        <li>Information</li>
        <li>About</li>
        <li>The</li>
        <li>Filters</li>
      </ol>
    );
  }
});
module.exports = FilterPickers;