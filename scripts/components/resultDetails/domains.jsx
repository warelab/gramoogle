'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var queryActions = require('../../actions/queryActions');
var detailsActions = require('../../actions/detailsActions');
var detailsStore = require('../../stores/detailsStore');

var Domains = React.createClass({
  //mixins: [Reflux.listenTo(detailsStore,"onStatusChange")],

  //onStatusChange: function(details) {
  //  this.setState({
  //    details: details.domains
  //  });
  //},

  //getInitialState: function() {
  //  return {};
  //},

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  //componentWillMount: function () {
  //  detailsActions.requireDetails('domains');
  //},
  //
  //componentWillUnmount: function () {
  //  detailsActions.forsakeDetails('domains');
  //},

  createFilter: function() {
    var drList = this.props.gene.domainRoots.split(' ');
    var qString;
    if (drList.length === 1) {
      qString = 'domainRoots:'+drList[0];
    }
    else {
      qString = '{!surround}domainRoots:2w('+drList.join(',')+')';
    }
    return {
      category: 'Domain Structure',
      fq:qString,
      id:qString,
      term: 'Domain structure like ' + this.props.gene.name
    };
  },

  filter: function() {
    queryActions.setFilter(this.createFilter());
  },
  
  render: function () {
    var gene = this.props.gene;
    var filterLink;
    if (gene.domainRoots) {
      filterLink = (
        <a onClick={this.filter}>Protein Domains</a>
      );
    }
    return (
      <span>{filterLink}</span>
    );
  }
});
module.exports = Domains;