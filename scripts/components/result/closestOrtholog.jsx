'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOrtholog = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    gene: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return this.getLutState();
  },
  render: function() {
    var gene, name, taxonId, desc, species;
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

    return (
      <div className="closest-ortholog">
        <h4>{name}
          <small>{species}</small>
        </h4>
        <p>{desc}</p>
      </div>
    )
  }
});

module.exports = ClosestOrtholog;