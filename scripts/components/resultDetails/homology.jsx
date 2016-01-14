'use strict';

var React = require('react');
var Reflux = require('reflux');
var queryActions = require('../../actions/queryActions');
var DocActions = require('../../actions/docActions');

var Homology = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object,
  },

  componentWillMount: function() {
    this.treeId = this.props.gene.grm_gene_tree;
    if(this.treeId) {
      DocActions.needDocs('genetrees', treeId);
    }
  },

  componentWillUnmount: function() {
    if(this.treeId) {
      DocActions.noLongerNeedDocs('genetrees', treeId);
    }
  },

  componentWillReceiveProps: function(newProps) {
    var genetreeDoc;
    if(this.treeId) {
      genetreeDoc = _.get(newProps, ['docs', 'genetrees', treeId]);
      if(genetreeDoc) {
        this.genetree = genetreeDoc;
      }
    }
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