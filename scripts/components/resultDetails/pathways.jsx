'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var DocActions = require('../../actions/docActions');
var docStore = require('../../stores/docStore');

var Pathways = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function() {
    return {};
  },

  componentWillMount: function() {
    this.pathwayIds = _.get(this.props, 'gene.ancestors.pathways');
    DocActions.needDocs('pathways', this.pathwayIds);
  },

  componentWillUnmount: function() {
    DocActions.noLongerNeedDocs('pathways', this.pathwayIds);
  },

  render: function () {
    var stuff = _.get(this.props, 'docs.pathways');
    if(stuff) {
      stuff = _.map(stuff, function(p, id) {
        return <li key={id}>{p}</li>;
      });
    }
    else {
      stuff = <li>Nothing yet.</li>
    }
    return (
      <ul>
        {stuff}
      </ul>
    );
  }
});
module.exports = Pathways;