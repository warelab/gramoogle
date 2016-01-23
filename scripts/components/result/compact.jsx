'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');
var queryActions = require('../../actions/queryActions');
//var visualizationStore = require('../stores/visualizationStore');
var detailsInventory = require('./details/_inventory');
var lutStore = require('../../stores/lutStore');

var CompactResult = React.createClass({
  propTypes: {
    searchResult: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired,
    geneDoc: React.PropTypes.object,
    docs: React.PropTypes.object, // all documents requested by the page.
    onDetailSelect: React.PropTypes.func.isRequired
  },

  mixins: [
    Reflux.connect(lutStore, 'luts')
  ],

  getInitialState: function() {
    return {
      visibleDetail: undefined,
      luts: lutStore.state
    };
  },

  detailClickHandlerFactory: function(geneDetail, isEnabled) {
    return function() {
      if(isEnabled) {
        // hide if already visible
        if (this.state.visibleDetail && this.state.visibleDetail.name === geneDetail.name) {
          this.setState(this.getInitialState());
          this.props.onDetailSelect();
        }
        else {
          this.setState({visibleDetail: geneDetail});
          this.props.onDetailSelect(geneDetail.name);
        }
      }
    }.bind(this);
  },

  render: function() {
    var searchResult, geneDoc, docs, linksEnabled, handlerFactory, detailLinks, visibleDetail;

    searchResult = this.props.searchResult;
    geneDoc = this.props.geneDoc;
    docs = this.props.docs;
    linksEnabled = !!geneDoc; // we should disable links if the gene doc isn't available yet.
    handlerFactory = this.detailClickHandlerFactory;
    detailLinks = _.map(this.props.details, function(geneDetail) {
      var handler, isActive, key, liClass, linkClass;

      handler = handlerFactory(geneDetail, linksEnabled);
      isActive = this.state.visibleDetail &&
          geneDetail.name === this.state.visibleDetail.name;
      key = searchResult.id + '-' + geneDetail.name;
      liClass = 'result-gene-detail-name' +
          (isActive ? ' active' : '');
      linkClass = linksEnabled ? '' : 'disabled';

      return (
        <li key={key} className={liClass}>
          <a className={linkClass} onClick={handler}>{geneDetail.name}</a>
        </li>
      );
    }.bind(this));

    if(this.state.visibleDetail) {
      visibleDetail = (
        <div className="visible-detail">
          {React.createElement(this.state.visibleDetail.reactClass, {gene: geneDoc, docs: docs, expanded: false})}
        </div>
      )
    }

    return (
      <div className="result-content">
        <ul className="result-links">
          {detailLinks}
        </ul>
        {visibleDetail}
      </div>
    );
  }
});

module.exports = CompactResult;