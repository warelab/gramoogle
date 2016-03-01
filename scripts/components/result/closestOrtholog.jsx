'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOrtholog = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    hidden: React.PropTypes.bool,
    gene: React.PropTypes.object.isRequired,
    onClick: React.PropTypes.func.isRequired,
    onMouseOver: React.PropTypes.func.isRequired,
    onMouseOut: React.PropTypes.func.isRequired
  },
  getInitialState: function() {
    return this.getLutState();
  },
  render: function() {
    var gene, name, taxonId, desc, species, className;
    gene = this.props.gene;
    if (gene.model_rep_id) {
      name = gene.model_rep_name || gene.model_rep_id;
      taxonId = gene.model_rep_taxon_id;
      desc = gene.model_rep_description;
    }
    else if (gene.closest_rep_id) {
      name = gene.closest_rep_name || gene.closest_rep_id;
      taxonId = gene.closest_rep_taxon_id;
      desc = gene.closest_rep_description;
    }

    if(taxonId && this.state.luts.taxon) {
      species = this.state.luts.taxon[taxonId];
    }

    className = 'closest-ortholog';
    if(this.props.hidden) {
      className += ' invisible';
    }

    return (
      <div className={className}
           onClick={this.props.onClick}
           onMouseOver={this.props.onMouseOver}
           onMouseOut={this.props.onMouseOut}>
        <h4>
          <span className="gene-id">{name}</span>
          <small className="species-name">{species}</small>
        </h4>
        <p>{desc}</p>
      </div>
    )
  }
});

module.exports = ClosestOrtholog;