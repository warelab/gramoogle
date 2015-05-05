'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var queryActions = require('../actions/queryActions');

var Result = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  createFilter: function() {
    var gt = this.props.gene.epl_gene_tree;
    return {
      category: 'Gene Tree',
      fq:'epl_gene_tree:' + gt,
      id:'epl_gene_tree:' + gt,
      term: 'Homolog of ' + this.props.gene.name
    };
  },

  filterQ: function() {
    queryActions.setFilter(this.createFilter());
  },

  newQ: function() {
    var filter = this.createFilter();
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

    return (
      <li className="result">
        <h4>{gene.name} <small>{gene.species}</small>
        </h4>
        <p>{gene.description}</p>
        <ul className="change-search">
          {genetreeLi}
        </ul>
      </li>
    );
  }
});
module.exports = Result;