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
        //var detail = React.createElement(geneDetail.reactClass, {gene: gene});
        //<div className="result-gene-detail">{detail}</div>

        return (
          <li>
            <div className="result-gene-detail-name">{geneDetail.name}</div>
          </li>
        );
      })
      .value();
    
    return (
      <li className="result">
        <h4>{gene.name} <small>{gene.species}</small>
        </h4>
        <p>{gene.description}</p>
        <ul className="result-links">
          {details}
        </ul>
        <Browser gene={gene} />
      </li>
    );
  }
});
module.exports = Result;