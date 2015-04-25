'use strict';

var React = require('react');

var FilterPickers = React.createClass({
  render: function() {
    return (
      <div className="filterPickers">
        <header>
          Hello
        </header>
        <ol>
          <li>Detailed</li>
          <li>Information</li>
          <li>About</li>
          <li>The</li>
          <li>Filters</li>
        </ol>
      </div>
    );
  }
});
module.exports = FilterPickers;