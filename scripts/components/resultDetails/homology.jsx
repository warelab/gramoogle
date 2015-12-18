'use strict';

var React = require('react');
var Reflux = require('reflux');
var queryActions = require('../../actions/queryActions');

var Homology = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  createAllFilters: function() {
    var gt, fq, result;
    gt = this.props.gene.grm_gene_tree;
    fq = 'grm_gene_tree:' + gt;
    result = {};
    result[fq] =  {
      category: 'Gene Tree',
      fq: fq,
      id: fq,
      display_name: 'Homolog of ' + this.props.gene.name
    }
    return result;
  },

  filter: function() {
    queryActions.setAllFilters(this.createAllFilters());
  },

  render: function () {
    return (
      <a onClick={this.filter}>Only homologs</a>
    );
  }
});
module.exports = Homology;