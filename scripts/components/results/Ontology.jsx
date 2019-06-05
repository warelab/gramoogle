'use strict';

import React from "react";
import searchStore from "../../stores/searchStore";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
import docStore from "../../stores/docStore";
import DocActions from "../../actions/docActions";
import _ from 'lodash';
import cytoscape from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs'
import dagre from 'cytoscape-dagre';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import ReactTable from 'react-table';

cytoscape.use(dagre);


export default class Ontology extends React.Component {
  constructor(props) {
    super(props);
    this.state = { tabIndex: 0 };
  }

  componentWillMount() {
    QueryActions.setResultType(this.props.facet, resultTypes.get('distribution',{
      'facet.field' : this.props.facet
    }));
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
      this.setState({terms: searchState.results[this.props.facet]})
    );

  }
  componentWillUnmount() {
    QueryActions.removeResultType(this.props.facet);
    this.unsubscribeFromSearchStore();
  }
  buildHierarchy(docs) {
    let nodes = [];
    let edges = [];
    docs.forEach(d => {
      let result = {id: d._id, name: d.id, label: d.name, count: this.state.terms.data[d._id].count, definition: d.def};
      nodes.push({data: result});
      if(d.is_a) {
        d.is_a.forEach(e => {
          edges.push({data: {source: d._id, target: e}});
        })
      }
    });
    console.log("buildHierarchy",docs);
    console.log('nodes', nodes);
    console.log('edges', edges);
    this.setState({nodes:nodes, edges: edges})
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.terms && !prevState.terms) {
      console.log('requesting term ancestors from docstore',this.state.terms);
      var idList = this.state.terms.sorted.map(term => term.id);
      DocActions.needDocs(this.props.collection, idList, null, ids => this.buildHierarchy(ids), {fl:'_id,id,name,def,is_a',rows:-1});
    }
  }
  renderTable() {
    let tableData = this.state.nodes.map(node => node.data);
    return (
      <ReactTable
        data={tableData}
        columns={[
          {
            Header: 'Id',
            accessor: 'name'
          },
          {
            Header: 'Number of Genes',
            accessor: 'count'
          },
          {
            Header: 'Name',
            accessor: 'label'
          },
          {
            Header: 'Definition',
            accessor: 'definition'
          }
        ]}
      />
    )
  }
  renderGraph() {
    return (
      <CytoscapeComponent
        cy = {cy => {
          this.cy = cy.fit();
          this.cy.layout({name: 'dagre', nodeDimensionsIncludeLabels: true, rankDir: 'BT'}).run();
        }}
        elements = {CytoscapeComponent.normalizeElements({nodes:this.state.nodes, edges:this.state.edges})}
        stylesheet = {[
          {
            selector: 'edge',
            style: {
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'width': '2px'
            }
          },
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'text-max-width': '100px',
              'text-wrap': 'wrap',
              'font-size': '16px',
              'background-color': 'mapData(count, 0, 100, blue, red)',
              'font-family': 'Helvetica'
            }
          }
        ]}
        style = { {width: '1000px', height: '700px'}}
      />
    )
  }
  render() {
    return (
      <div>
        <h1>{this.props.name}</h1>
        <Tabs selectedIndex={this.state.tabIndex} onSelect={tabIndex => this.setState({ tabIndex })}>
          <TabList>
            <Tab>Table</Tab>
            <Tab>Graph</Tab>
          </TabList>
          <TabPanel>
            { this.state.nodes && this.renderTable() }
          </TabPanel>
          <TabPanel>
            { this.state.nodes && this.renderGraph() }
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}
