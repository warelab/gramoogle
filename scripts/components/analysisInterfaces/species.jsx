'use strict';

var React = require('react');
var NeedsDataMixin = require('./NeedsDataMixin');

var taxonId = 'taxon_id';

var Species = React.createClass({
  mixins: [ NeedsDataMixin.of(taxonId) ],
  render: function() {
    return (
      <div className="filter">
        <h1>Species distribution goes here</h1>
        <p>This is where the filter UI would go</p>
      </div>
    );
  }
});

module.exports = Species;