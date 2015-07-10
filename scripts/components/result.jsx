'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');
var queryActions = require('../actions/queryActions');
var detailsInventory = require('./resultDetails/_inventory');
var Browser = require('./browser.jsx');

var Result = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },
  
  render: function () {
    var gene = this.props.gene;
    var details = _.chain(detailsInventory)
      .filter(function(geneDetail) {
        return geneDetail.test(gene);
      })
      .map(function(geneDetail) {
        return React.createElement(geneDetail.reactClass, {gene: gene});
      })
      .value();
    
    return (
      <li className="result">
        <h4>{gene.name} <small>{gene.species}</small>
        </h4>
        <p>{gene.description}</p>
        <ul className="change-search">
          {details}
        </ul>
        <Browser gene={gene} />
      </li>
    );
  }
});
module.exports = Result;