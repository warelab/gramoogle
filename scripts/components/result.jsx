'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');
var queryActions = require('../actions/queryActions');
var detailsInventory = require('./resultDetails/_inventory');

var ResultExpanded = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired
  },

  render: function() {
    return (
      <div>I am expanded</div>
    );
  }
});

var ResultSmall = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired,
    expandResult: React.PropTypes.func.isRequired
  },

  getInitialState: function() {
    return {
      visibleDetail: undefined
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
        className = 'result-gene-detail-name' + (isActive ? ' active' : '');

      return (
        <li className={className}>
          <a onClick={handler}>{geneDetail.name}</a>
        </li>
      );
    }.bind(this));

    if(this.state.visibleDetail) {
      visibleDetail = (
        <div className="visible-detail">
          {React.createElement(this.state.visibleDetail.reactClass, {gene: gene})}
        </div>
      )
    }

    return (
      <div className="result-content">
        <ul className="result-links">
          {detailLinks}
          <li><a onClick={this.props.expandResult}>[Expand All]</a></li>
        </ul>
        {visibleDetail}
      </div>
    );
  }
});

var Result = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  getInitialState: function() {
    return {
      expanded: false
    };
  },

  toggleExpanded: function() {
    this.setState({expanded: !this.state.expanded});
  },
  
  render: function () {
    var gene, details, content, glyph;

    gene = this.props.gene;
    details = _.filter(detailsInventory, function(geneDetail) {
      return geneDetail.test(gene);
    });

    if(this.state.expanded) {
      content = <ResultExpanded gene={gene} details={details} />;
      glyph = 'menu-down';
    }
    else {
      content = <ResultSmall gene={gene} details={details} expandResult={this.toggleExpanded} />;
      glyph = 'menu-right';
    }

    return (
      <li className="result">
        <h4>
          <a onClick={this.toggleExpanded}><bs.Glyphicon glyph={glyph} /> {gene.name}</a>
          &nbsp;<small>{gene.species}</small>
        </h4>
        <p>{gene.description}</p>
        {content}
      </li>
    );
  }
});

module.exports = Result;