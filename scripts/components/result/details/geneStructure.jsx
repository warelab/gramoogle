'use strict';

var React = require('react');
var bs = require('react-bootstrap');

var DallianceBrowser = require('./geneStructure/dallianceBrowser.jsx');
var Location = require('./geneStructure/location.jsx');

var GeneStructure = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    expanded: React.PropTypes.bool
  },

  render: function () {
    var gene, ensemblSummaryUrl;

    gene = this.props.gene;

    // TODO: USe CSS Substring matching to put little icon after link to ensembl
    // http://blog.teamtreehouse.com/css3-substring-matching-attribute-selectors
    ensemblSummaryUrl = '//ensembl.gramene.org/' + gene.system_name + '/Gene/Summary?g=' + gene._id;

    return (
      <div>
        <DallianceBrowser gene={gene} expanded={this.props.expanded} />
        <bs.Row>
          <bs.Col xs={12} md={4}>
            <Location gene={gene} />
          </bs.Col>
          <bs.Col xs={12} md={8}>
            <h5>Links</h5>
            <ul>
              <li>
                <a href={ensemblSummaryUrl}>Ensembl Gene view</a>
              </li>
            </ul>
          </bs.Col>
        </bs.Row>
      </div>
    );
  }
});

module.exports = GeneStructure;