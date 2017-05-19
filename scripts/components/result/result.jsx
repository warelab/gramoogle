'use strict';

import React from "react";
import _ from "lodash";
import DocActions from "../../actions/docActions";
import detailsInventory from "./details/_inventory";
import ResultDetails from "./ResultDetails.jsx";
import ResultBody from "./ResultBody.jsx";

export default class Result extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentWillUnmount() {
    DocActions.noLongerNeedDocs('genes', this.props.searchResult.id);
  }

  requestGeneDoc() {
    if (!this.requestedGeneDoc) {
      this.requestedGeneDoc = true;

      DocActions.needDocs(
          'genes',
          this.props.searchResult.id
      );
    }
  }

  updateVisibleDetail(visibleDetail) {
    this.setState({
      visibleDetail: visibleDetail
    });
  }

  hoverHomologyTab() {
    this.setState({hoverDetail: 'homology'});
  }

  unhoverHomologyTab() {
    this.setState({hoverDetail: undefined});
  }

  selectHomologyTab() {
    var homologyTab = _.find(detailsInventory, {name: 'Homology'});
    this.setState({visibleDetail: homologyTab});
  }

  render() {
    return (
        <li className="result"
            onMouseOver={this.requestGeneDoc.bind(this)}>

          <ResultBody searchResult={this.props.searchResult}
                      hoverHomologyTab={this.hoverHomologyTab.bind(this)}
                      unhoverHomologyTab={this.unhoverHomologyTab.bind(this)}
                      selectHomologyTab={this.selectHomologyTab.bind(this)}
          />

          <ResultDetails details={this.getApplicableDetails()}
                         visibleDetail={this.state.visibleDetail}
                         enabled={!!this.props.geneDoc}
                         hoverDetailCapability={_.get(this.state.hoverDetail, 'capability')}
                         geneDoc={this.props.geneDoc}
                         docs={this.props.docs}
                         speciesName={this.props.searchResult.species_name}
                         onDetailSelect={this.updateVisibleDetail.bind(this)}
          />
        </li>
    );
  }

  getApplicableDetails() {
    if (this.props.searchResult.taxon_id === 29760) { // hard-coded exception for Vitis vinifera
      this.props.searchResult.capabilities = _.filter(this.props.searchResult.capabilities, function(c) { return c !== 'expression'});
    }
    const searchResult = this.props.searchResult;
    return _.filter(detailsInventory, function (geneDetail) {
      return _.includes(searchResult.capabilities, geneDetail.capability);
    });
  }
}

Result.propTypes = {
  searchResult: React.PropTypes.object.isRequired, // SOLR search result
  geneDoc: React.PropTypes.object, // from Mongo
  docs: React.PropTypes.object // all documents requested by the page.
};