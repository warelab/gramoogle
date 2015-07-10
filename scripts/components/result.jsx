'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');
var queryActions = require('../actions/queryActions');
var detailsInventory = require('./resultDetails/_inventory');

var Result = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return { visibleDetail: undefined };
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
  
  render: function () {
    var gene = this.props.gene,
        handlerFactory = this.detailClickHandlerFactory,
        details = _.chain(detailsInventory)
      .filter(function(geneDetail) {
        return geneDetail.test(gene);
      })
      .map(function(geneDetail) {
        var handler = handlerFactory(geneDetail),
            isActive = this.state.visibleDetail &&
              geneDetail.name === this.state.visibleDetail.name,
            className = 'result-gene-detail-name' + (isActive ? ' active' : '');

        return (
          <li className={className}>
            <a onClick={handler}>{geneDetail.name}</a>
          </li>
        );
      }.bind(this))
      .value();

    var visibleDetail;
    if(this.state.visibleDetail) {
      visibleDetail = (
        <div className="visible-detail">
          {React.createElement(this.state.visibleDetail.reactClass, {gene: gene})}
        </div>
      )
    }

    return (
      <li className="result">
        <h4>{gene.name} <small>{gene.species}</small>
        </h4>
        <p>{gene.description}</p>
        <ul className="result-links">
          {details}
        </ul>
        {visibleDetail}
      </li>
    );
  }
});
module.exports = Result;