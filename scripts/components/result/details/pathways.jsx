'use strict';

var React = require('react');
const Reflux = require('reflux');
var _ = require('lodash');
import QueryActions from "../../../actions/queryActions";
var DocActions = require('../../../actions/docActions');
var docStore = require('../../../stores/docStore');
var reactomeURL = require('../../../../package.json').gramene.reactomeURL;
import searchStore from "../../../stores/searchStore";
var FlatToNested = require('flat-to-nested');
import TreeMenu from 'react-tree-menu';
import {Explore, Links} from "./generic/detail.jsx";



var Pathways = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object // all documents requested by the page.
  },
  mixins: [
    Reflux.connect(docStore, 'docs')
  ],

  getInitialState: function() {
    this.holderId = 'displayHolder' + this.props.gene._id;
    return {
      taxonomy: searchStore.taxonomy
    };
  },

  initDiagram: function() {
    this.diagram = Reactome.Diagram.create({
      proxyPrefix: reactomeURL, //'//plantreactome.gramene.org', //'//plantreactomedev.oicr.on.ca', ////cord3084-pc7.science.oregonstate.edu', // reactomedev.oicr.on.ca
      placeHolder: this.holderId,
      width: this.divWrapper.clientWidth - 350,
      height: (!!this.props.closeModal) ? window.innerHeight - 300 : 500
    });
  },

  stableId: function(dbId) {
    let prefix = this.state.taxonomy.indices.id[this.props.gene.taxon_id].model.reactomePrefix || 'OSA';
    return `R-${prefix}-${dbId}`;
  },

  loadDiagram: function(pathwayId, reactionId) {
    if (!this.diagram) this.initDiagram();
    this.diagram.loadDiagram(pathwayId);

    this.diagram.onDiagramLoaded(function (loaded) {
      this.loadedDiagram = loaded;
      if (reactionId) {
        this.diagram.selectItem(reactionId);
      }
      // var xref = _.find(this.props.gene.xrefs,{db : 'Gramene_Plant_Reactome'}).ids[0];
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

  componentDidUpdate(prevProps, prevState) {
    if (this.state.hierarchy && ! this.state.selectedNode) {
      let node = this.state.hierarchy[0];
      let path = [0];
      let parent = node;
      while (node.children) {
        path.push(0);
        parent = node;
        node = node.children[0];
      }
      console.log(parent,node,path);
      this.loadNodes(path);
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
      let [r,speciesCode,id] = reaction.id.split('-');

      this.pathwayIds.push(+id); 
    }.bind(this));

    DocActions.needDocs('pathways', this.pathwayIds, (docs) => { return this.makeTaxonSpecific(docs,this.props.gene.taxon_id)}, this.getHierarchy);
  },

  makeTaxonSpecific: function (docs,taxon_id) {
//    if (taxon_id === 39947) taxon_id = 4530;
    let lineageField = 'lineage_'+taxon_id;
    let tsDocs = docs.map(function(doc) {
      let tsDoc = _.pick(doc,['_id','name','type']);
      tsDoc.lineage = doc[lineageField];
      return tsDoc;
    });
    console.log(tsDocs);
    return tsDocs;
  },

  componentWillUnmount: function() {
    DocActions.noLongerNeedDocs('pathways', this.pathwayIds);
    if (this.diagram) this.diagram.detach();
  },

  getHierarchy: function (docs) {
    let pathways = _.keyBy(docs,'_id');
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
            checkbox: false,
            selected: false,
            parent: parentOffset >=0 ? line[parentOffset] : undefined
          });
        });
      }
    });

    let nested = new FlatToNested().convert(nodes);

    this.setState({hierarchy: [nested], selectedNode: undefined});
  },

  loadNodes: function(nodes) {
    let hierarchy = this.state.hierarchy;
    let selectedNode = this.state.selectedNode;
    let offset = nodes.shift();
    let nodeRef = hierarchy[offset];
    let lineage = [nodeRef];
    nodes.forEach(function(n) {
      nodeRef = nodeRef.children[n];
      lineage.unshift(nodeRef);
    });
    if (lineage[0].id !== 2894885) {
      let pathway = this.stableId(lineage[0].id);
      let reaction = undefined;
      if (lineage[0].type === "Reaction") {
        reaction = pathway;
        pathway = this.stableId(lineage[1].id);
      }
      if (lineage[0].selected) {
        selectedNode = undefined;
        lineage[0].selected = false;
        if (this.loadedDiagram === pathway) {
          this.diagram.resetSelection();
        }
        else {
          if (this.diagram) this.diagram.resetSelection();
          this.loadDiagram(pathway);
        }
      }
      else {
        if (selectedNode) {
          selectedNode.selected = false;
        }
        selectedNode = lineage[0];
        lineage[0].selected = true;
        if (this.loadedDiagram === pathway) {
          if (reaction) {
            this.diagram.selectItem(reaction);
          }
          else {
            this.diagram.resetSelection();
          }
        }
        else {
          if (this.diagram) this.diagram.resetSelection();
          if (reaction) {
            this.loadDiagram(pathway, reaction);
          }
          else {
            this.loadDiagram(pathway);
          }
        }
      }
      this.setState({hierarchy: hierarchy, selectedNode: selectedNode});
    }
  },

  renderHierarchy: function() {
    if(this.state.hierarchy) {
      return (
        <TreeMenu
          data={this.state.hierarchy}
          expandIconClass="fa fa-chevron-right"
          collapseIconClass="fa fa-chevron-down"
          stateful={true}
          collapsible={true}
          onTreeNodeClick={this.loadNodes.bind(this)}
        />
      );
    }
    else {
      return <div>Nothing yet.</div>
    }
  },

  updateQuery() {
    let fq = `pathways__ancestors:${this.state.selectedNode.id}`;
    let filterDisplayName = `${this.state.selectedNode.label}`;
    console.log("User asked to filter by "+ this.state.selectedNode.type);

    let filter = {
      category: 'Plant Reactome',
      id: fq,
      fq: fq,
      display_name: filterDisplayName
    };

    QueryActions.removeAllFilters();
    QueryActions.setFilter(filter);
    if (this.props.closeModal) this.props.closeModal();
  },

  render: function () {
    let reactomeLink,searchFilter;

    if (this.state.selectedNode) {
      let xrefLUT = _.keyBy(this.props.gene.xrefs,'db');
      let links = [
        {name: 'Plant Reactome Gene', url: `${reactomeURL}/content/detail/${xrefLUT.notGramene_Plant_Reactome.ids[0]}`},
        {name: 'Plant Reactome '+this.state.selectedNode.type, url: `${reactomeURL}/content/detail/${this.stableId(this.state.selectedNode.id)}`}
      ];
      reactomeLink = <Links key="links" links={links}/>;
      let filters = [
        {
          name: `All genes in this ${this.state.selectedNode.type}`,
          handleClick: ()=>this.updateQuery()
        }
      ];
      searchFilter = <Explore key="explore" explorations={filters}/>;
    }
    return (
      <div ref={(div) => {this.divWrapper = div;}}>
        <div style={{width:350, height:(!!this.props.closeModal) ? window.innerHeight - 300 : 500, overflow:'scroll', float:'left'}}>{this.renderHierarchy()}</div>
        <div id={this.holderId}></div>
        {searchFilter}
        {reactomeLink}
      </div>
    );
  }
});
module.exports = Pathways;
