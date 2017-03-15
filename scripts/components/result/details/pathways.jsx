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
    this.holderId = 'displayHolder' + this.props.gene._id;
    return {
    };
  },

  initDiagram: function() {
    this.diagram = Reactome.Diagram.create({
      proxyPrefix: '//reactome.org', // cord3084-pc7.science.oregonstate.edu reactomedev.oicr.on.ca
      placeHolder: this.holderId,
      width: this.divWrapper.clientWidth,
      height: (!!this.props.closeModal) ? window.innerHeight : 500
    });
  },

  loadDiagram: function(pathwayId, reactionId) {
    pathwayId = "R-HSA-15869";
    reactionId = "R-HSA-111804";

    this.diagram.loadDiagram(pathwayId);

    this.diagram.onDiagramLoaded(function (loaded) {
      this.diagram.selectItem(reactionId);
      this.diagram.flagItems("TXN"); //this.props.gene._id);
    }.bind(this));
  },

  componentDidMount: function() {
    if (Reactome && Reactome.Diagram) {
      this.initDiagram();
    }
    else {
      window.addEventListener('launchDiagram', function (e) {
        this.initDiagram()
      }.bind(this));
    }
  },

  componentWillMount: function() {
    var pathways, reactionId, ancestorIds;
    pathways = _.get(this.props, 'gene.annotations.pathways');
    if(!pathways) {
      throw new Error("No pathway annotation present for " + _.get(this.props, 'gene._id'));
    }

    this.pathwayIds = _.clone(pathways.ancestors);
    pathways.entries.forEach(function(reaction) {
      this.pathwayIds.push(reaction.id); 
    }.bind(this));

    DocActions.needDocs('pathways', this.pathwayIds, this.getHierarchy);
  },

  componentWillUnmount: function() {
    DocActions.noLongerNeedDocs('pathways', this.pathwayIds);
  },

  getHierarchy: function (docs) {
    let pathways = _.keyBy(docs, '_id');
    let reactions = [];
    this.pathwayIds.forEach(function (pwyId) {
      let pwy = pathways[pwyId];
      if (pwy.type === 'Reaction') reactions.push(pwy);
    }.bind(this));

    let lineage = reactions[0].lineage[0];
    let pwy = pathways[lineage[lineage.length - 2]];
    this.loadDiagram(`R_ATH_${pwy.id}`, `R_ATH_${reactions[0].id}`);

    this.setState({hierarchy: 'root'});
    return docs;
  },


  renderHierarchy: function() {
    if(this.state.hierarchy) {
      return <div>ok</div>
    }
    else {
      return <div>Nothing yet.</div>
    }
  },

  render: function () {
    return (
      <div ref={(div) => {this.divWrapper = div;}}>
        {/*<ReactomeImg pathwayId={this.pathwayId} />*/}
        {this.renderHierarchy()}
        <div id={this.holderId}></div>
      </div>
    );
  }
});
module.exports = Pathways;