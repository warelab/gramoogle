'use strict';

import React from "react";
import _ from "lodash";
import DocActions from "../../actions/docActions";
import detailsInventory from "./details/_inventory";
import LutMixin from "../../mixins/LutMixin";
import ResultDetails from "./ResultDetails.jsx";
import ResultBody from "./ResultBody.jsx";

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
        <li className={this.getClassName()} 
            onMouseOver={this.requestGeneDoc}>
          
          <ResultBody searchResult={this.props.searchResult}
                      speciesName={this.getSpeciesName()}
                      hoverHomologyTab={this.hoverHomologyTab}
                      unhoverHomologyTab={this.unhoverHomologyTab}
                      selectHomologyTab={this.selectHomologyTab}
          />
          
          <ResultDetails details={this.getApplicableDetails()}
                         visibleDetail={this.state.visibleDetail}
                         enabled={!!this.props.geneDoc}
                         hoverDetailCapability={_.get(this.state.hoverDetail, 'capability')}
                         geneDoc={this.props.geneDoc}
                         docs={this.props.docs}

                         onDetailSelect={this.updateVisibleDetail}
          />
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

  getSpeciesName: function() {
    const taxonLut = _.get(this.state, 'luts.taxon');
    const taxonId = _.get(this.props.searchResult, 'taxon_id');
    if (taxonLut && taxonId) {
      return taxonLut[taxonId];
    }
  },

  getApplicableDetails: function () {
    const searchResult = this.props.searchResult;
    return _.filter(detailsInventory, function (geneDetail) {
      return _.includes(searchResult.capabilities, geneDetail.capability);
    });
  }
});

module.exports = Result;