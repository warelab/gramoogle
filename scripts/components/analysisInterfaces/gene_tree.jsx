'use strict';

var geneTreeField = 'epl_gene_tree';
var geneTreeTaxonField = 'epl_gene_tree_root_taxon_id';
var React = require('react');
var NeedsData = require('./NeedsDataMixin');

var GeneTree = React.createClass({
  mixins: [ NeedsData.of(geneTreeField, geneTreeTaxonField) ],
  render: function() {
    var data = this.getNeededData(geneTreeField) || [];
    var taxa = this.getNeededData(geneTreeTaxonField) || [];

    var details;

    if(!data.count) {
      details = (
        <p>Nothing. I got nothing.</p>
      )
    }
    else if(data.count === 1) {
      details = (
        <p>REMIND ME TO TELL YOU ABOUT THIS ONE GENE TREE</p>
      );
    }
    else {
      details = (
        <ul>
          <li>There are {data.count} gene trees here</li>
          <li>There are {taxa.count} distinct root taxa</li>
        </ul>
      );
    }

    return (
      <div className="filter">
        <h1>Homologs! From EPL gene tree!</h1>
        {details}
      </div>
    );
  }
});

module.exports = GeneTree;