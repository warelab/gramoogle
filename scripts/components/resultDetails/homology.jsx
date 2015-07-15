'use strict';

var React = require('react');
var Reflux = require('reflux');
var queryActions = require('../../actions/queryActions');
var detailsActions = require('../../actions/detailsActions');
var detailsStore = require('../../stores/detailsStore');

var Homology = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  createFilter: function() {
    var gt = this.props.gene.grm_gene_tree;
    return {
      category: 'Gene Tree',
      fq:'grm_gene_tree:' + gt,
      id:'grm_gene_tree:' + gt,
      term: 'Homolog of ' + this.props.gene.name
    };
  },

  filter: function() {
    queryActions.setFilter(this.createFilter());
  },

  render: function () {
    return (
      <a onClick={this.filter}>Only homologs</a>
    );
  }
});
module.exports = Homology;