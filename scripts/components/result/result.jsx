'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');

var DocActions = require('../../actions/docActions');

var detailsInventory = require('./../resultDetails/_inventory');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOrtholog = require('./closestOrtholog.jsx');
var ExpandedResult = require('./expanded.jsx');
var CompactResult = require('./compact.jsx');

var Result = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    searchResult: React.PropTypes.object.isRequired, // SOLR search result
    geneDoc: React.PropTypes.object, // from Mongo
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function() {
    var state = this.getLutState();
    state.expanded = false;
    return state;
  },

  toggleExpanded: function() {
    this.setState({expanded: !this.state.expanded});
  },

  requestGeneDoc: function() {
    if(!this.props.geneDoc) {
      DocActions.needDocs('genes', this.props.searchResult.id);
    }
  },

  componentWillUnmount: function () {
    DocActions.noLongerNeedDocs('genes', this.props.searchResult.id);
  },

  render: function () {
    var searchResult, geneDoc, docs, species, title, body, details, representativeGene, content, glyph, className;

    searchResult = this.props.searchResult;
    geneDoc = this.props.geneDoc;
    docs = this.props.docs;

    if(this.state.luts.taxon) {
      species = this.state.luts.taxon[searchResult.taxon_id];
    }

    className = 'result';
    details = _.filter(detailsInventory, function(geneDetail) {
      return _.includes(searchResult.capabilities, geneDetail.capability);
    });

    if(this.state.expanded) {
      content = <ExpandedResult geneDoc={geneDoc} details={details} docs={docs} />;
      glyph = 'menu-down';
      className += ' expanded';
    }
    else {
      content = <CompactResult searchResult={searchResult} geneDoc={geneDoc} details={details} docs={docs} />;
      glyph = 'menu-right';
    }

    title = (
      <h3 className="gene-name">
        <a onClick={this.toggleExpanded}>
          <bs.Glyphicon glyph={glyph}/>
        </a>
        <a onClick={this.toggleExpanded}>{searchResult.name}</a>
        &nbsp;
        <small>{species}</small>
      </h3>
    );

    body = <p className="gene-description">{searchResult.description}</p>;

    if(searchResult.closest_rep_id || (searchResult.model_rep_id && searchResult.model_rep_id !== searchResult.id)) {
      representativeGene = <ClosestOrtholog gene={searchResult} />;
    }

    return (
      <li className={className} onMouseOver={this.requestGeneDoc}>

        <bs.Row>
          <bs.Col xs={12} sm={6} md={8}>
            {title}
            {body}
          </bs.Col>

          <bs.Col xs={12} sm={6} md={4}>
            {representativeGene}
          </bs.Col>
        </bs.Row>
        {content}
      </li>
    );
  }
});

module.exports = Result;