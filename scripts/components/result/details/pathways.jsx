'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var DocActions = require('../../../actions/docActions');
var docStore = require('../../../stores/docStore');

var ReactomeItem = require('./pathways/reactomeItem.jsx');
var ReactomeImg = require('./pathways/reactomeImg.jsx');

var Pathways = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function() {
    return {};
  },

  componentWillMount: function() {
    var pathways, reactionId, ancestorIds;
    pathways = _.get(this.props, 'gene.annotations.pathways');
    if(!pathways) {
      throw new Error("No pathway annotation present for " + _.get(this.props, 'gene._id'));
    }

    ancestorIds = pathways.ancestors;
    if(!ancestorIds) {
      throw new Error("Reactome ancestors are required because that's where the Pathway is");
    }

    this.pathwayId = _.head(ancestorIds);

    if(_.get(pathways, 'entries.length') != 1) {
      console.error("Number of reactions is not 1");
    }

    reactionId = _.get(pathways, 'entries[0].id');
    this.pathwayIds = [+reactionId].concat(ancestorIds);

    DocActions.needDocs('pathways', this.pathwayIds);
  },

  componentWillUnmount: function() {
    DocActions.noLongerNeedDocs('pathways', this.pathwayIds);
  },

  getReaction: function() {
    var rxnId, rxn;
    if(!this.reaction) {
      rxnId = _.head(this.pathwayIds);
      rxn = _.get(this.props.docs, ['pathways', rxnId]);
      if(rxn) {
        this.reaction = rxn;
      }
    }
    return this.reaction;
  },

  renderHierarchy: function() {
    var reactionData, currentNodeId, currentNode, els;
    reactionData = this.getReaction();
    if(reactionData) {
      currentNodeId = reactionData._id;
      els = [];
      while(currentNodeId) {
        currentNode = this.props.docs.pathways[currentNodeId];
        els.push( <ReactomeItem key={currentNodeId} reactomeItem={currentNode}/> );
        currentNodeId = _.get(currentNode, 'parents[0]');
      }
    }
    else {
      els = <li>Nothing yet.</li>
    }
    return els;
  },

  render: function () {
    return (
      <div>
        <ReactomeImg pathwayId={this.pathwayId} />
        <ul>
          {this.renderHierarchy()}
        </ul>
      </div>
    );
  }
});
module.exports = Pathways;