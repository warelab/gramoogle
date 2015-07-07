'use strict';

var React = require('react');
var Reflux = require('reflux');
var NeedsDataMixin = require('./../../mixins/NeedsDataMixin');
var visualizationStore = require('../../stores/visualizationStore');

var taxonId = 'taxon_id';

var Species = React.createClass({
  mixins: [
    NeedsDataMixin.of(taxonId),
    Reflux.connect(visualizationStore, 'visData')
  ],
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