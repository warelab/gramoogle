'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var queryActions = require('../actions/queryActions');

var Result = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  createHomologyFilter: function() {
    var gt = this.props.gene.epl_gene_tree;
    return {
      category: 'Gene Tree',
      fq:'epl_gene_tree:' + gt,
      id:'epl_gene_tree:' + gt,
      term: 'Homolog of ' + this.props.gene.name
    };
  },

  createDomainsFilter: function() {
    var drList = this.props.gene.domainRoots.split(' ');
    var qString;
    if (drList.length === 1) {
      qString = 'domainRoots:'+drList[0];
    }
    else {
      qString = '{!surround}domainRoots:2w('+drList.join(',')+')';
    }
    return {
      category: 'Domain Structure',
      fq:qString,
      id:qString,
      term: 'Domain structure like ' + this.props.gene.name
    };
  },

  filterQ: function() {
    queryActions.setFilter(this.createHomologyFilter());
  },

  newQ: function() {
    var filter = this.createHomologyFilter();
    var filters = {};
    filters[filter.fq] = filter;

    queryActions.setAllFilters(filters);
  },

  filterD: function() {
    queryActions.setFilter(this.createDomainsFilter());
  },

  newD: function() {
    var filter = this.createDomainsFilter();
    var filters = {};
    filters[filter.fq] = filter;

    queryActions.setAllFilters(filters);
  },
  
  render: function () {
    var gene = this.props.gene;
    var genetreeLi;
    if(gene.epl_gene_tree) {
      genetreeLi = (
        <li>
          <bs.Button bsSize="small" onClick={this.filterQ}>Only homologs</bs.Button>
          <bs.Button bsSize="small" onClick={this.newQ}>See all homologs</bs.Button>
        </li>
      );
    }
    
    var domainArch;
    if(gene.domainRoots) {
      domainArch = (
        <li>
          <bs.Button bsSize="small" onClick={this.filterD}>Apply domain structure filter</bs.Button>
          <bs.Button bsSize="small" onClick={this.newD}>All genes with this domain structure</bs.Button>
        </li>
      );
    }

    return (
      <li className="result">
        <h4>{gene.name} <small>{gene.species}</small>
        </h4>
        <p>{gene.description}</p>
        <ul className="change-search">
          {genetreeLi}{domainArch}
        </ul>
      </li>
    );
  }
});
module.exports = Result;