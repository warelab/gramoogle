'use strict';

var React = require('react');
var _ = require('lodash');
var queryActions = require('../../actions/queryActions');

var CompactResult = React.createClass({
  propTypes: {
    searchResult: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired,
    geneDoc: React.PropTypes.object,
    docs: React.PropTypes.object, // all documents requested by the page.
    onDetailSelect: React.PropTypes.func.isRequired,
    hoverDetail: React.PropTypes.string,
    visibleDetail: React.PropTypes.object
  },

  detailClickHandlerFactory: function(geneDetail, isEnabled) {
    return function() {
      if(isEnabled) {
        // hide if already visible
        if (this.props.visibleDetail && this.props.visibleDetail.name === geneDetail.name) {
          this.props.onDetailSelect();
        }
        else {
          this.props.onDetailSelect(geneDetail);
        }
      }
    }.bind(this);
  },

  render: function() {
    var searchResult, geneDoc, docs, linksEnabled, handlerFactory, detailLinks, visibleDetailElement, visibleDetailComponent;

    searchResult = this.props.searchResult;
    geneDoc = this.props.geneDoc;
    docs = this.props.docs;
    linksEnabled = !!geneDoc; // we should disable links if the gene doc isn't available yet.
    handlerFactory = this.detailClickHandlerFactory;
    detailLinks = _.map(this.props.details, function(geneDetail) {
      var handler, isActive, key, liClass, linkClass, simulateHover;

      handler = handlerFactory(geneDetail, linksEnabled);
      isActive = this.props.visibleDetail &&
          geneDetail.name === this.props.visibleDetail.name;
      simulateHover = this.props.hoverDetail &&
          this.props.hoverDetail === geneDetail.capability;

      key = searchResult.id + '-' + geneDetail.name;
      liClass = 'result-gene-detail-name' +
          (isActive ? ' active' : '') +
          (simulateHover ? ' hover' : '');
      linkClass = linksEnabled ? '' : 'disabled';

      return (
        <li key={key} className={liClass}>
          <a className={linkClass} onClick={handler}>{geneDetail.name}</a>
        </li>
      );
    }.bind(this));

    if(this.props.visibleDetail) {
      visibleDetailComponent = this.props.visibleDetail.reactClass;
      visibleDetailElement = (
        <div className="visible-detail">
          {React.createElement(visibleDetailComponent, {gene: geneDoc, docs: docs, expanded: false})}
        </div>
      )
    }

    return (
      <div className="result-content">
        <ul className="result-links">
          {detailLinks}
        </ul>
        {visibleDetailElement}
      </div>
    );
  }
});

module.exports = CompactResult;