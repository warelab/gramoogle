'use strict';

var React = require('react');
var dataMixin = require('./NeedsDataMixin').for('epl_gene_tree');

var GeneTree = React.createClass({
  mixins: [dataMixin],
  render: function() {
    return (
      <div className="filter">
        <h1>Homologs! From EPL gene tree!</h1>
        <p>This is where the filter UI would go</p>
      </div>
    );
  }
});

module.exports = GeneTree;