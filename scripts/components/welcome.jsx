'use strict';

var React = require('react');

module.exports = React.createClass({
  render: function() {
    return (
      <div className="welcome">
        <h1>Welcome!</h1>
        <p>Gramene is a <em>curated</em>, <em>open-source</em>, <em>
          integrated data resource</em> for comparative
          functional genomics in crops and model
          plant species.</p>
        <h2>Search</h2>
        <p>We have a new search engine that you can use to ask sophisticated questions
          about the genes across all of our crop and model plant genomes. For example:</p>
        <ul>
          <li>What are the homologs of Arabidopsis thaliana's PAD4 gene in the Oryzeae?</li>
          <li>What genes in A. thaliana are in the pyruvate metabolism pathway and use NAD(P)H as cofactor?</li>
        </ul>
      </div>
    );
  }
});