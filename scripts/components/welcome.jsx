'use strict';

var _ = require('lodash');
var React = require('react');
var QueryActions = require('../actions/queryActions');

var exampleQueries = [
  {
    displayText: "What are the homologs of Arabidopsis thaliana's " +
                 "PAD4 gene in the Oryzeae?",
    filters: {"grm_gene_tree:EPlGT00140000001539":{"category":"Gene Tree","fq":"grm_gene_tree:EPlGT00140000001539","id":"grm_gene_tree:EPlGT00140000001539","term":"Homolog of PAD4"},"NCBITaxon_ancestors:147380":{"term":"Oryzeae","weight":594548,"fq":"NCBITaxon_ancestors:147380","name":"Oryzeae","id":"NCBITaxon:147380","category":"Taxonomy","score":594548,"exclude":false}}
  },
  {
    displayText: "What cytosolic genes in A. thaliana and Z. mays " +
                 "are in the pyruvate metabolism pathway and bind " +
                 "either NAD or NADP?",
    filters: {"GO_ancestors:6090":{"term":"pyruvate metabolic process","weight":8641,"fq":"GO_ancestors:6090","name":"pyruvate metabolic process","id":"GO:0006090","category":"GO process","score":8641,"exclude":false},"NCBITaxon_ancestors:4577":{"term":"Zea mays","weight":110301,"fq":"NCBITaxon_ancestors:4577","name":"Zea mays","id":"NCBITaxon:4577","category":"Taxonomy","score":110301000,"exclude":false},"NCBITaxon_ancestors:3702":{"term":"Arabidopsis thaliana","weight":33602,"fq":"NCBITaxon_ancestors:3702","name":"Arabidopsis thaliana","id":"NCBITaxon:3702","category":"Taxonomy","score":33602000,"exclude":false},"GO_ancestors:51287":{"term":"NAD binding","weight":2819,"fq":"GO_ancestors:51287","name":"NAD binding","id":"GO:0051287","category":"GO function","score":2819,"exclude":false},"GO_ancestors:50661":{"term":"NADP binding","weight":2510,"fq":"GO_ancestors:50661","name":"NADP binding","id":"GO:0050661","category":"GO function","score":2510,"exclude":false},"GO_ancestors:5829":{"term":"cytosol","weight":19238,"fq":"GO_ancestors:5829","name":"cytosol","id":"GO:0005829","category":"GO component","score":19238,"exclude":false}}
  }
];

module.exports = React.createClass({
  render: function () {
    var examples = _.map(exampleQueries, function(egQ, idx) {
      var resetFilters = function() {
        QueryActions.setAllFilters(egQ.filters);
      };
      return (
        <li key={idx}><a onClick={resetFilters}>{egQ.displayText}</a></li>
      );
    });
    return (
      <div className="welcome">
        <h1>Welcome!</h1>

        <p>Gramene is a <em>curated</em>, <em>open-source</em>, <em>
          integrated data resource</em> for comparative
          functional genomics in crops and model
          plant species.</p>

        <h2>Search</h2>

        <p>We have a new, easy to use search engine. <strong>
          Try typing into the box at the top of the screen!</strong>
          </p>

        <h3>Features</h3>

        <div className="features row">
          <div className="feature col-md-4">
            <div className="well">
              <strong>Suggestions</strong>
              <p>Suggested terms are provided as you type:</p>
              <img className="img-responsive" src="assets/images/welcome/suggestions.png" />
            </div>
          </div>

          <div className="feature col-md-4">
            <div className="well">
              <strong>Visualization</strong>
              <p>See the distribution of results across all genomes:</p>
              <img className="img-responsive" src="assets/images/welcome/vis.png" />
            </div>
          </div>

          <div className="feature col-md-4">
            <div className="well">
              <strong>Gene view</strong>
              <p>Concise view of available information about a gene:</p>
              <img className="img-responsive" src="assets/images/welcome/gene_view.png" />
            </div>
          </div>
        </div>

        <h3>For Example</h3>
        <p>You can use to ask sophisticated questions
          about the genes across all of our databases
          concerning crop and model plant genomes:</p>

        <ul>
          {examples}
        </ul>

        <h2>Gramene Portals</h2>

        <p>Alternatively, you can access the underlying data sources directly:</p>
        <ul>
          <li><a href="http://ensembl.gramene.org/genome_browser/index.html"><strong>Genome Browser</strong></a>: Browse gene annotations &amp; diversity data</li>
          <li><a href="http://ensembl.gramene.org/Tools/Blast?db=core"><strong>BLAST</strong></a>: Align DNA &amp; protein sequences</li>
          <li><a href="http://plantreactome.gramene.org"><strong>Plant Reactome</strong></a>: Browse metabolic &amp; regulatory pathways</li>
          <li><a href="http://pathway.gramene.org"><strong>Pathways databases</strong></a>: BioCyc based cellular metabolic networks for 10 plant species</li>
          <li><a href="http://www.gramene.org/biomart/martview"><strong>Gramene Mart</strong></a>: Customized data queries</li>
          <li><a href="http://gramene.org/ftp-download"><strong>Bulk downloads</strong></a></li>
          <li><a href="/archive">ARCHIVE</a> - Markers, Proteins and Ontology databases, QTLs, Comparative Maps</li>
        </ul>
      </div>
    );
  }
});