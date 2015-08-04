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
    var gene, details;

    gene = this.props.gene;

    details = this.props.details.map(function(detail) {
      var component = React.createElement(detail.reactClass, {gene: gene, expanded: true}),
        key = gene.id + '-exp-' + detail.name;
      return (
        <div className="expanded-detail">
          <h4>{detail.name}</h4>
          {component}
        </div>
      );
    });


    return (
      <div className="expanded-details">
        {details}
      </div>
    );
  }
});

var ResultSmall = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired
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
    var gene, details, content, glyph, className;

    gene = this.props.gene;
    className = 'result';
    details = _.filter(detailsInventory, function(geneDetail) {
      return geneDetail.test(gene);
    });

    if(this.state.expanded) {
      content = <ResultExpanded gene={gene} details={details} />;
      glyph = 'menu-down';
      className += ' expanded';
    }
    else {
      content = <ResultSmall gene={gene} details={details} />;
      glyph = 'menu-right';
    }

    return (
      <li className={className}>
        <h3 className="gene-name">
          <a onClick={this.toggleExpanded}><bs.Glyphicon glyph={glyph} /></a>
          <a onClick={this.toggleExpanded}>{gene.name}</a>
          &nbsp;<small>{gene.species}</small>
        </h3>
        <p className="gene-description">{gene.description}</p>
        {content}
      </li>
    );
  }
});

module.exports = Result;