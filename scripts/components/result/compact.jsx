'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');
var queryActions = require('../../actions/queryActions');
//var visualizationStore = require('../stores/visualizationStore');
var detailsInventory = require('./../resultDetails/_inventory');
var lutStore = require('../../stores/lutStore');

var CompactResult = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired
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

  detailClickHandlerFactory: function(geneDetail) {
    return function() {
      // hide if already visible
      if(this.state.visibleDetail && this.state.visibleDetail.name === geneDetail.name) {
        this.setState(this.getInitialState());
      }
      else {
        this.setState({ visibleDetail: geneDetail });
      }
    }.bind(this);
  },

  render: function() {
    var gene, handlerFactory, detailLinks, visibleDetail;

    gene = this.props.gene;
    handlerFactory = this.detailClickHandlerFactory;
    detailLinks = _.map(this.props.details, function(geneDetail) {
      var handler = handlerFactory(geneDetail),
        isActive = this.state.visibleDetail &&
          geneDetail.name === this.state.visibleDetail.name,
        key = gene.id + '-' + geneDetail.name,
        className = 'result-gene-detail-name' + (isActive ? ' active' : '');

      return (
        <li key={key} className={className}>
          <a onClick={handler}>{geneDetail.name}</a>
        </li>
      );
    }.bind(this));

    if(this.state.visibleDetail) {
      visibleDetail = (
        <div className="visible-detail">
          {React.createElement(this.state.visibleDetail.reactClass, {gene: gene, expanded: false})}
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