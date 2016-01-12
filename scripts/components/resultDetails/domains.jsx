'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');

var queryActions = require('../../actions/queryActions');

var QueryTerm = require('../result/queryTerm.jsx');

var Domains = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object
  },

  createFilter: function() {
    var drList = _.get(this.props, 'gene.canonical_translation.domain_roots');
    if(drList) {
      drList = drList.split(' ');

      var qString;
      if (drList.length === 1) {
        qString = 'domain_roots:' + drList[0];
      }
      else {
        qString = '{!surround}domain_roots:2w(' + drList.join(',') + ')';
      }
      return {
        category: 'Domain Structure',
        fq: qString,
        id: qString,
        display_name: 'Domain structure like ' + this.props.gene.name
      }
    }
  },

  filter: function() {
    queryActions.setFilter(this.createFilter());
  },
  
  render: function () {
    var gene, transcriptId, translation, filterLink, ensemblDomainsUrl;
    gene = this.props.gene;
    translation = _.get(this.props, 'gene.canonical_translation');
    transcriptId = _.get(this.props, 'gene.canonical_transcript.name');
// http://ensembl.gramene.org/Arabidopsis_thaliana/Transcript/Domains?g=AT3G52430;r=3:19431371-19434403;t=AT3G52430.1
    ensemblDomainsUrl = '//ensembl.gramene.org/' + gene.system_name + '/Transcript/Domains?g=' + gene._id + ';t=' + transcriptId;

    if (translation) {
      filterLink = (
        <QueryTerm name="Same Domains" handleClick={this.filter} />
      );
    }
    return (
      <div>
        <h5>Change the query</h5>
        <span>{filterLink}</span>
        <h5>Links</h5>
        <ul>
          <li>
            <a href={ensemblDomainsUrl}>Ensembl Transcript Domains view</a>
          </li>
        </ul>
      </div>
    );
  }
});
module.exports = Domains;