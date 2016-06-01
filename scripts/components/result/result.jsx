'use strict';

import React from "react";
import _ from "lodash";
import DocActions from "../../actions/docActions";
import detailsInventory from "./details/_inventory";
import LutMixin from "../../mixins/LutMixin";
import ClosestOrtholog from "./closestOrtholog.jsx";
import ResultDetailLink from "./ResultDetailLink.jsx";

const Result = React.createClass({
  mixins: [LutMixin.lutFor('taxon')],
  propTypes: {
    searchResult: React.PropTypes.object.isRequired, // SOLR search result
    geneDoc: React.PropTypes.object, // from Mongo
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function () {
    var state = this.getLutState();
    state.visibleDetail = undefined;
    state.hoverDetail = undefined;
    return state;
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

  updateVisibleDetail: function (visibleDetail) {
    this.setState({
      visibleDetail: visibleDetail
    });
  },

  hoverHomologyTab: function () {
    this.setState({hoverDetail: 'homology'});
  },

  unhoverHomologyTab: function () {
    this.setState({hoverDetail: undefined});
  },

  selectHomologyTab: function () {
    var homologyTab = _.find(detailsInventory, {name: 'Homology'});
    this.setState({visibleDetail: homologyTab});
  },

  render: function () {
    return (
        <li className={this.getClassName()} onMouseOver={this.requestGeneDoc}>

          <div className="result-gene-summary">
            <div className="result-gene-title-body">
                 {this.renderTitle()}
                 {this.renderBody()}
            </div>
               {this.renderMetadata()}
          </div>
            {this.renderResultDetails()}
        </li>
    );
  },

  renderMetadata: function() {
    return this.renderSummary() || this.renderClosestOrthologMaybe();
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
    var searchResult, species, taxonLut, geneId;

    searchResult = this.props.searchResult;
    taxonLut = _.get(this.state, 'luts.taxon');
    if (taxonLut) {
      species = <span className="species-name">{taxonLut[searchResult.taxon_id]}</span>;
    }
    if (searchResult.id !== searchResult.name) {
      geneId = <span className="gene-id">{searchResult.id}</span>;
    }

    return (
        <h3 className="gene-title">
          <span className="gene-name">{searchResult.name} </span>
          <wbr/>
          <small className="gene-subtitle">{geneId} </small>
          <small className="gene-species">{species}</small>
        </h3>
    );
  },

  renderBody: function () {
    return (
        <p className="gene-description">{this.props.searchResult.description}</p>
    );
  },

  renderSummary: function () {
    var summary, text, onClick;

    summary = this.props.searchResult.summary;
    if (!summary) {
      return;
    }

    onClick = function () {};
    text = summary;

    if (summary.length > 160) {
      text = summary.substr(0, 150) + '…';
    }

    return (
        <div className="gene-summary-tair">
          <p>{text}</p>
        </div>
    )
  },

  renderClosestOrthologMaybe: function () {
    var searchResult, visibleDetail, showClosestOrtholog, homologyDetailsVisible;

    searchResult = this.props.searchResult;
    visibleDetail = this.state.visibleDetail;
    homologyDetailsVisible = _.get(visibleDetail, 'name') === 'Homology';

    // show closest ortholog prominently if we have data to show:-
    //   a. either there's a closest ortholog (determined by traversing the gene tree until an id or description looks
    // curated) b. or there's a model ortholog (traverse tree to find an otholog in arabidopsis)
    showClosestOrtholog = (
        searchResult.closest_rep_id || (
            searchResult.model_rep_id &&
            searchResult.model_rep_id !== searchResult.id
        )
    );

    if (showClosestOrtholog) {

      // we used to not add the closest ortholog to the DOM if the homology detail was visible.
      // however, that could cause the height of the result to change. Instead we set visibility:hidden
      // so that the renderer takes into account the height of the ortholog even if not shown.
      return (
          <ClosestOrtholog gene={searchResult}
                           onMouseOver={this.hoverHomologyTab}
                           onMouseOut={this.unhoverHomologyTab}
                           onClick={this.selectHomologyTab}
                           hidden={homologyDetailsVisible}/>
      );
    }
  },

  renderResultDetails: function () {
    return (
        <div className="result-content">
          <ul className="result-links">
              {this.renderDetailLinks()}
          </ul>
             {this.renderVisibleDetailElement()}
        </div>
    );
  },

  renderVisibleDetailElement: function() {
    if(this.state.visibleDetail) {
      const visibleDetailComponent = this.state.visibleDetail.reactClass;
      return (
          <div className="visible-detail">
               {React.createElement(visibleDetailComponent, {gene: this.props.geneDoc, docs: this.props.docs})}
          </div>
      )
    }
  },

  renderDetailLinks: function() {
    const linkProps = {
      enabled: !!this.props.geneDoc,
      visibleDetailName: _.get(this.state.visibleDetail, 'name'),
      hoverDetailCapability: _.get(this.state.hoverDetail, 'capability'),
      onDetailSelect: this.updateVisibleDetail
    };

    return _.map(this.getApplicableDetails(), (resultDetail, key) =>
        <ResultDetailLink key={key}
                          detail={resultDetail}
                          {...linkProps} />);
  },

  getApplicableDetails: function() {
    const searchResult = this.props.searchResult;
    return _.filter(detailsInventory, function (geneDetail) {
      return _.includes(searchResult.capabilities, geneDetail.capability);
    });
  }
});

module.exports = Result;