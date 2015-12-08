'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');
var detailsInventory = require('./../resultDetails/_inventory');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOrtholog = require('./closestOrtholog.jsx');
var ExpandedResult = require('./expanded.jsx');
var CompactResult = require('./compact.jsx');

var Result = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    var state = this.getLutState();
    state.expanded = false;
    return state;
  },

  toggleExpanded: function() {
    this.setState({expanded: !this.state.expanded});
  },

  render: function () {
    var gene, species, title, body, details, representativeGene, content, glyph, className;

    gene = this.props.gene;
    if(this.state.luts.taxon) {
      species = this.state.luts.taxon[gene.taxon_id];
    }

    className = 'result';
    details = _.filter(detailsInventory, function(geneDetail) {
      return geneDetail.test(gene);
    });

    if(this.state.expanded) {
      content = <ExpandedResult gene={gene} details={details} />;
      glyph = 'menu-down';
      className += ' expanded';
    }
    else {
      content = <CompactResult gene={gene} details={details} />;
      glyph = 'menu-right';
    }

    title = (
      <h3 className="gene-name">
        <a onClick={this.toggleExpanded}>
          <bs.Glyphicon glyph={glyph}/>
        </a>
        <a onClick={this.toggleExpanded}>{gene.name}</a>
        &nbsp;
        <small>{species}</small>
      </h3>
    );

    body = <p className="gene-description">{gene.description}</p>;

    if(gene.rep_id) {
      representativeGene = <ClosestOrtholog gene={gene} />;
    }

    return (
      <li className={className}>
        {title}
        <bs.Row>
          <bs.Col xs={12} md={6}>
            {body}
          </bs.Col>

          <bs.Col xs={12} md={6}>
            {representativeGene}
          </bs.Col>
        </bs.Row>
        {content}
      </li>
    );
  }
});

module.exports = Result;