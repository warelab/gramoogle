'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var queryActions = require('../actions/queryActions');
var detailsActions = require('../actions/detailsActions');
var detailsStore = require('../stores/detailsStore');

var Domains = React.createClass({
  mixins: [Reflux.listenTo(detailsStore,"onStatusChange")],

  onStatusChange: function(details) {
    this.setState({
      details: details.domains
    });
  },

  getInitialState: function() {
    return {}
  },

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  componentWillMount: function () {
    detailsActions.requireDetails('domains');
  },

  componentWillUnmount: function () {
    detailsActions.forsakeDetails('domains');
  },

  createDomainsFilter: function() {
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
    queryActions.setFilter(this.createDomainsFilter());
  },
  
  render: function () {
    var gene = this.props.gene;
    var details = this.state.details;
    var listOfDomains;
    var filterButton;
    if(gene.domainList && details) {
      var dList = gene.domainList.map(function(ipr_id) {
        if (details[ipr_id]) {
          var name = details[ipr_id].name
          var rand = Math.random();
          return (
            <li key={rand}>{name}</li>
          );
        }
        else {
          console.log(ipr_id,'has no details',details);
        }
      });
      listOfDomains = (<ol>{dList}</ol>);
    }
    if (gene.domainRoots) {
      filterButton = (
        <bs.Button bsSize="small" onClick={this.filter}>Apply domain structure filter</bs.Button>
      );
    }
    return (
      <div>{listOfDomains}{filterButton}</div>
    );
  }
});
module.exports = Domains;