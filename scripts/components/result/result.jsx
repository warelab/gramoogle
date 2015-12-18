'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');

var GeneActions = require('../../actions/geneActions');

var detailsInventory = require('./../resultDetails/_inventory');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOrtholog = require('./closestOrtholog.jsx');
var ExpandedResult = require('./expanded.jsx');
var CompactResult = require('./compact.jsx');

var Result = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    expandedByDefault: React.PropTypes.bool,
    searchResult: React.PropTypes.object.isRequired, // SOLR search result
    geneDoc: React.PropTypes.object // from Mongo
  },

  getInitialState: function() {
    var state = this.getLutState();
    state.expanded = this.props.expandedByDefault;
    return state;
  },

  toggleExpanded: function() {
    if(!this.props.expandedByDefault) {
      this.setState({expanded: !this.state.expanded});
    }
  },

  requestGeneDoc: function() {
    if(!this.props.geneDoc) {
      GeneActions.needGeneDoc(this.props.searchResult.id);
    }
  },

  componentWillUnmount: function () {
    GeneActions.noLongerNeedGeneDoc(this.props.searchResult.id);
  },

  render: function () {
    var searchResult, geneDoc, species, title, body, details, representativeGene, content, glyph, className;

    searchResult = this.props.searchResult;
    geneDoc = this.props.geneDoc;

    if(this.state.luts.taxon) {
      species = this.state.luts.taxon[searchResult.taxon_id];
    }

    className = 'result';
    details = _.filter(detailsInventory, function(geneDetail) {
      return _.includes(searchResult.capabilities, geneDetail.capability);
    });

    if(this.state.expanded) {
      content = <ExpandedResult geneDoc={geneDoc} details={details} />;
      glyph = 'menu-down';
      className += ' expanded';
    }
    else {
      content = <CompactResult searchResult={searchResult} geneDoc={geneDoc} details={details} />;
      glyph = 'menu-right';
    }

    title = (
      <h3 className="gene-name">
        <a onClick={this.toggleExpanded}>
          <bs.Glyphicon glyph={glyph}/>
        </a>
        <a onClick={this.toggleExpanded}>{searchResult.name}</a>
        &nbsp;
        <small>{species} {searchResult.id}</small>
      </h3>
    );

    body = <p className="gene-description">{searchResult.description}</p>;

    if(searchResult.rep_id) {
      representativeGene = <ClosestOrtholog gene={searchResult} />;
    }

    return (
      <li className={className} onMouseOver={this.requestGeneDoc}>
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