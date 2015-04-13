'use strict';

var React = require('react');

var FilterPickers = React.createClass({
  render: function() {
    return (
      <ol className="filterPickers">
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