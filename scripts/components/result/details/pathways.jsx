'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var DocActions = require('../../../actions/docActions');
var docStore = require('../../../stores/docStore');

var ReactomeItem = require('./pathways/reactomeItem.jsx');

var Pathways = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function() {
    return {};
  },

  componentWillMount: function() {
    var ancestorIds, reactionIds;
    ancestorIds = _.get(this.props, 'gene.ancestors.pathways');
    reactionIds = _.get(this.props, 'gene.xrefs.pathways');

    if(reactionIds.length != 1) {
      console.error("Number of reactions is not 1");
    }

    this.pathwayIds = reactionIds.concat(ancestorIds);

    DocActions.needDocs('pathways', this.pathwayIds);
  },

  componentWillUnmount: function() {
    DocActions.noLongerNeedDocs('pathways', this.pathwayIds);
  },

  getReaction: function() {
    var rxnId, rxn;
    if(!this.reaction) {
      rxnId = _.first(this.pathwayIds);
      rxn = _.get(this.props.docs, ['pathways', rxnId]);
      if(rxn) {
        this.reaction = rxn;
      }
    }
    return this.reaction;
  },

  render: function () {
    var reactionData, currentNodeId, currentNode, els;
    reactionData = this.getReaction();
    if(reactionData) {
      currentNodeId = reactionData._id;
      els = [];
      while(currentNodeId) {
        currentNode = this.props.docs.pathways[currentNodeId];
        els.push( <ReactomeItem reactomeItem={currentNode}/> );
        currentNodeId = _.get(currentNode, 'parents[0]');
      }
    }
    else {
      els = <li>Nothing yet.</li>
    }
    return (
      <ul>
        {els}
      </ul>
    );
  }
});
module.exports = Pathways;