'use strict';

var React = require('react');
var _ = require('lodash');
var DocActions = require('../../../actions/docActions');
var docStore = require('../../../stores/docStore');
import searchStore from "../../../stores/searchStore";
var FlatToNested = require('flat-to-nested');
import TreeMenu from 'react-tree-menu';
var Pathways = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object // all documents requested by the page.
  },

  getInitialState: function() {
    this.holderId = 'displayHolder' + this.props.gene._id;
    return {
      taxonomy: searchStore.taxonomy,
    };
  },

  initDiagram: function() {
    this.diagram = Reactome.Diagram.create({
      proxyPrefix: '//cord3084-pc7.science.oregonstate.edu', // reactomedev.oicr.on.ca
      placeHolder: this.holderId,
      width: this.divWrapper.clientWidth,
      height: (!!this.props.closeModal) ? window.innerHeight : 500
    });
  },

  loadDiagram: function(pathwayId, reactionId) {
    // pathwayId = "R-OSA-8933811";
    // reactionId = "R-OSA-8933859";
    let prefix = this.state.taxonomy.indices.id[this.props.gene.taxon_id].model.reactomePrefix;
    pathwayId = `R-${prefix}-${pathwayId}`;
    reactionId= `R-${prefix}-${reactionId}`;
    console.log('loadDiagram', pathwayId, reactionId);
    this.initDiagram();
    this.diagram.loadDiagram(pathwayId);

    this.diagram.onDiagramLoaded(function (loaded) {
      this.diagram.selectItem(reactionId);
      this.diagram.flagItems(this.props.gene._id);
    }.bind(this));
  },

  componentDidMount: function() {
    if (Reactome && Reactome.Diagram) {
      // this.initDiagram();
    }
    else {
      window.addEventListener('launchDiagram', function (e) {
        // this.initDiagram()
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
    if (this.diagram) this.diagram.detach();
  },

  getHierarchy: function (docs) {
    let pathways = _.keyBy(docs, '_id');
    let nodes = [];
    this.pathwayIds.forEach(function (pwyId) {
      if (pathways[pwyId]) {
        let pwy = pathways[pwyId];
        pwy.lineage.forEach(function(line) {
          let parentOffset = line.length - 2;
          nodes.push({
            id: pwyId,
            label: pwy.name,
            type: pwy.type,
            parent: parentOffset >=0 ? line[parentOffset] : undefined
          });
        });
      }
    });

    let nested = new FlatToNested().convert(nodes);

    this.setState({hierarchy: [nested]});
    return docs;
  },


  renderHierarchy: function() {
    if(this.state.hierarchy) {

      var onClick = function(nodes) {
        console.log('onClick',nodes,this.state.hierarchy);
        let offset = nodes.shift();
        let nodeRef = this.state.hierarchy[offset];
        let lineage = [nodeRef];
        nodes.forEach(function(n) {
          nodeRef = nodeRef.children[n];
          lineage.unshift(nodeRef);
        });
        console.log('leaf',lineage);
        if (lineage[0].type === "Reaction") {
          this.loadDiagram(lineage[1].id,lineage[0].id);
        }
      };

      return (
        <TreeMenu
          data={this.state.hierarchy}
          expandIconClass="fa fa-chevron-right"
          collapseIconClass="fa fa-chevron-down"
          stateful={true}
          onTreeNodeClick={onClick.bind(this)}
        />
      );
    }
    else {
      if (this.state.docs && this.state.docs.pathways) {
        this.getHierarchy(this.state.docs.pathways);
      }
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