'use strict';

var React = require('react');
var Reflux = require('reflux');
var queryActions = require('../../actions/queryActions');
var DocActions = require('../../actions/docActions');
var _ = require('lodash');

var QueryTerm = require('../result/queryTerm.jsx');

function orthoParaList(homology, thisGeneId, type) {
  if(homology) {
    return _(homology)
      .pick(function filterCategories(thing, name) {
        return name.indexOf(type) === 0;
      })
      .push(thisGeneId)
      .values()
      .flatten()
      .value();
  }
}

var Homology = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object.isRequired
  },

  componentWillMount: function() {
    this.orthologs = this.orthologList();
    this.paralogs = this.paralogList();
    this.treeId = this.props.gene.grm_gene_tree;

    if(this.treeId) {
      DocActions.needDocs('genetrees', this.treeId);
    }

    //this.genetree = this.props.docs.genetrees[this.props.gene.grm_gene_tree];
  },

  componentWillUnmount: function() {
    DocActions.noLongerNeedDocs('genetrees', this.treeId);
  },

  orthologList: function() {
    return orthoParaList(this.props.gene.homology, this.props.gene._id, 'ortholog');
  },

  paralogList: function() {
    return orthoParaList(this.props.gene.homology, this.props.gene._id, 'within_species_paralog');
  },

  createAllHomologsFilters: function() {
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

  createOrthologFilters: function() {
    var fq, idList, result;
    fq = 'id:(' + this.orthologs.join(' ') + ')';
    result = {};
    result[fq] = {
      category: 'Gene Tree',
      id: fq,
      fq: fq,
      display_name: 'Orthologs of ' + this.props.gene.name
    };
    return result;
  },

  createParalogFilters: function() {
    var fq, idList, result;
    fq = 'id:(' + this.paralogs.join(' ') + ')';
    result = {};
    result[fq] = {
      category: 'Gene Tree',
      id: fq,
      fq: fq,
      display_name: 'Paralogs of ' + this.props.gene.name
    };
    return result;
  },

  filterAllHomologs: function() {
    queryActions.setAllFilters(this.createAllHomologsFilters());
  },

  filterOrthologs: function() {
    queryActions.setAllFilters(this.createOrthologFilters());
  },

  filterParalogs: function() {
    queryActions.setAllFilters(this.createParalogFilters());
  },

  render: function () {
    var tree;
    if(this.treeId) {
      tree = _.get(this.props, ['docs', 'genetrees', this.treeId]);
    }

    var filters = [
      <QueryTerm key="all"
                 name="Show All Homologs"
                 count={0}
                 handleClick={this.filterAllHomologs} />
    ];
    if(this.orthologs) {
      filters.push(<QueryTerm key="ortho"
                              name="Show Orthologs"
                              count={this.orthologs.length}
                              handleClick={this.filterOrthologs} />)
    }
    if(this.paralogs) {
      filters.push(<QueryTerm key="para"
                              name="Show Paralogs"
                              count={this.paralogs.length}
                              handleClick={this.filterParalogs} />)
    }

    return (
      <div>
        {filters}
      </div>
    );
  }
});
module.exports = Homology;