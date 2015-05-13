'use strict';

var React = require('react');
var dataMixin = require('./NeedsDataMixin').for('biotype');

var Species = React.createClass({
  mixins: [dataMixin],
  render: function() {
    return (
      <div className="filter">
        <h1>Are your biotypes biased?</h1>
        <p>This is where the filter UI would go</p>
      </div>
    );
  }
});

module.exports = Species;