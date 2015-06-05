'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
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
      fq:'epl_gene_tree:' + gt,
      id:'epl_gene_tree:' + gt,
      term: 'Homolog of ' + this.props.gene.name
    };
  },

  filter: function() {
    queryActions.setFilter(this.createFilter());
  },

  render: function () {
    return (
      <li>
        <bs.Button bsSize="small" onClick={this.filterQ}>Only homologs</bs.Button>
      </li>
    );
  }
});
module.exports = Homology;