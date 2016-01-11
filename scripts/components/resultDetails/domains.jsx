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
    var translation = _.get(this.props, 'gene.canonical_translation');
    var filterLink;
    if (translation) {
      filterLink = (
        <QueryTerm name="Same Domains" handleClick={this.filter} />
      );
    }
    return (
      <span>{filterLink}</span>
    );
  }
});
module.exports = Domains;