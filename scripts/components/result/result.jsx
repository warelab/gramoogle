'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');

var DocActions = require('../../actions/docActions');

var detailsInventory = require('./details/_inventory');
var LutMixin = require('../../mixins/LutMixin');

var ClosestOrtholog = require('./closestOrtholog.jsx');
var ExpandedResult = require('./expanded.jsx');
var CompactResult = require('./compact.jsx');

var Result = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    expandedByDefault: React.PropTypes.bool,
    searchResult: React.PropTypes.object.isRequired, // SOLR search result
    geneDoc: React.PropTypes.object, // from Mongo
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function () {
    var state = this.getLutState();
    state.expanded = this.props.expandedByDefault;
    state.homologyDetailsVisible = false;
    return state;
  },

  componentWillReceiveProps: function (nextProps) {
    if (!this.state.expanded && nextProps.expandedByDefault) {
      this.setState({expanded: nextProps.expandedByDefault});
    }
  },

  componentWillUnmount: function () {
    DocActions.noLongerNeedDocs('genes', this.props.searchResult.id);
  },

  requestGeneDoc: function () {
    if (!this.requestedGeneDoc) {
      this.requestedGeneDoc = true;
      DocActions.needDocs('genes', this.props.searchResult.id);
    }
  },

  toggleExpanded: function () {
    if (!this.props.expandedByDefault) {
      this.setState({expanded: !this.state.expanded});
    }
  },

  checkIfHomologyDetailsAreVisible: function (selectedDetailName) {
    this.setState({homologyDetailsVisible: (selectedDetailName === 'Homology')});
  },

  render: function () {
    var className, title, body, details, closestOrtholog;

    className = this.getClassName();
    title = this.renderTitle();
    body = this.renderBody();
    details = this.renderResultDetails();
    closestOrtholog = this.renderClosestOrthologMaybe();

    return (
      <li className={className} onMouseOver={this.requestGeneDoc}>

        <div className="result-gene-summary">
          <div className="result-gene-title-body">
            {title}
            {body}
          </div>
          {closestOrtholog}
        </div>
        {details}
      </li>
    );
  },

  getClassName: function () {
    var classNames;

    classNames = ['result'];
    if (this.state.expanded) {
      classNames.push('expanded');
    }

    return classNames.join(' ');
  },

  renderTitle: function () {
    var glyph, searchResult, species, taxonLut, geneId;

    searchResult = this.props.searchResult;
    glyph = this.state.expanded ? 'menu-down' : 'menu-right';
    taxonLut = _.get(this.state, 'luts.taxon');
    if (taxonLut) {
      species = <span className="species-name">{taxonLut[searchResult.taxon_id]}</span>;
    }
    if (searchResult.id !== searchResult.name) {
      geneId = <span className="gene-id">{searchResult.id}</span>;
    }

    return (
      <h3 className="gene-title">
        <a className="gene-title-anchor" onClick={this.toggleExpanded}>
          <bs.Glyphicon glyph={glyph}/>
          <span className="gene-name">{searchResult.name}</span>
        </a>

        <small>{geneId}{species}</small>
      </h3>
    );
  },

  renderBody: function () {
    return (
      <p className="gene-description">{this.props.searchResult.description}</p>
    );
  },

  renderClosestOrthologMaybe: function () {
    var searchResult, showClosestOrtholog;

    searchResult = this.props.searchResult;

    // show closest ortholog prominently if:
    // 1. we are not in expanded mode (the homology details tab is thus visible, see point 2.)
    // 2. the homolgy details tab is not visible (it contains this information as well)
    // 3. we have data to show:-
    //   a. either there's a closest ortholog (determined by traversing the gene tree until an id or description looks
    // curated) b. or there's a model ortholog (traverse tree to find an otholog in arabidopsis)
    showClosestOrtholog = !this.state.expanded && !this.state.homologyDetailsVisible &&
      (
        searchResult.closest_rep_id || (
          searchResult.model_rep_id &&
          searchResult.model_rep_id !== searchResult.id
        )
      );

    if (showClosestOrtholog) {
      return (
        <ClosestOrtholog gene={searchResult}/>
      );
    }
  },

  renderResultDetails: function () {
    var geneDoc, docs, details, searchResult;

    geneDoc = this.props.geneDoc;
    docs = this.props.docs;
    searchResult = this.props.searchResult;

    details = _.filter(detailsInventory, function (geneDetail) {
      return _.includes(searchResult.capabilities, geneDetail.capability);
    });

    if (this.state.expanded) {
      return <ExpandedResult geneDoc={geneDoc}
                             details={details}
                             docs={docs}/>;
    }
    else {
      return <CompactResult searchResult={searchResult}
                            geneDoc={geneDoc}
                            details={details}
                            docs={docs}
                            onDetailSelect={this.checkIfHomologyDetailsAreVisible}/>;
    }
  }
});

module.exports = Result;