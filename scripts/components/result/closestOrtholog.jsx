'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOtholog = React.createClass({
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
    name = gene.rep_name || gene.rep_id;
    taxonId = gene.rep_taxon_id;
    desc = gene.rep_desc;
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

module.exports = ClosestOtholog;