'use strict';

import React from "react";
import searchStore from "../../stores/searchStore";
import backgroundSetStore from "../../stores/backgroundSetStore";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
import DocActions from "../../actions/docActions";
import cytoscape from 'cytoscape';
import CytoscapeComponent from 'react-cytoscapejs'
import popper from 'cytoscape-popper';
import tippy from 'tippy.js';
import dagre from 'cytoscape-dagre';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import ReactTable from 'react-table';
import _ from 'lodash';

cytoscape.use(dagre);
cytoscape.use(tippy);
cytoscape.use(popper);

function lngamm (z) {
  // Reference: "Lanczos, C. 'A precision approximation
  // of the gamma function', J. SIAM Numer. Anal., B, 1, 86-96, 1964."
  // Translation of  Alan Miller's FORTRAN-implementation
  // See http://lib.stat.cmu.edu/apstat/245

  let x = 0;
  x += 0.1659470187408462e-06 / (z + 7);
  x += 0.9934937113930748e-05 / (z + 6);
  x -= 0.1385710331296526     / (z + 5);
  x += 12.50734324009056      / (z + 4);
  x -= 176.6150291498386      / (z + 3);
  x += 771.3234287757674      / (z + 2);
  x -= 1259.139216722289      / (z + 1);
  x += 676.5203681218835      / (z);
  x += 0.9999999999995183;
  return (Math.log (x) - 5.58106146679532777 - z + (z - 0.5) * Math.log (z + 6.5));
}

function lnfact (n) {
  if (n <= 1) return (0);
  return (lngamm (n + 1));
}

function lnbico (n, k) {
  return (lnfact (n) - lnfact (k) - lnfact (n - k));
}

function exact_nc (n11, n12, n21, n22, w) {
  let x = n11;
  let m1 = n11 + n21;
  let m2 = n12 + n22;
  let n = n11 + n12;
  let x_min = Math.max (0, n - m2);
  let x_max = Math.min (n, m1);
  let l = [];

  for (let y = x_min; y <= x_max; y++) {
    l[y - x_min] = (lnbico (m1, y) + lnbico (m2, n - y) + y * Math.log (w));
  }
  let max_l = Math.max.apply (Math, l);

  let sum_l = l.map (function (x) { return Math.exp (x - max_l); }).reduce (function (a, b) {
    return a + b; }, 0);
  sum_l = Math.log (sum_l);

  let den_sum = 0;
  for (let y = x; y <= x_max; y++) {
    den_sum += Math.exp (l[y - x_min] - max_l);
  }
  den_sum = Math.log (den_sum);
  return Math.exp (den_sum - sum_l);
}

export default class Ontology extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tabIndex: 0
    };
  }

  handleSearchResults(searchState) {
    const terms = searchState.results[this.props.facet];
    var idList = terms.sorted.map(term => term.id);
    DocActions.needDocs(this.props.collection, idList, null, ids => this.buildHierarchy(ids), {fl:'_id,id,name,def,description,is_a',rows:-1});
    this.setState({terms: terms, stateGenes: searchState.results.metadata.count})
  }

  handleBgSet(searchState) {
    let tableData = this.state.nodes.map(node => node.data);
    let bgData = searchState.results[this.props.facet].data;
    let bgTotal = searchState.results.metadata.count;
    let selTotal = this.state.stateGenes;
    tableData.forEach(term => {
      const m = bgData[term.id].count; //.find(x => x.name === tableData[row].name).count
      const n11 = term.count;
      const n12 = selTotal - n11;
      const n21 = m - n11;
      const n22 = bgTotal - m - (selTotal - n11);
      const w = 1.25;
      term.enrichment = exact_nc(n11, n12, n21, n22, w);
      term.bgCount = m;
    });

    tableData.sort((a, b) => (a.enrichment > b.enrichment) ? 1 : -1);
    let mValue = tableData.length;
    let qValue = 0.25;
    for (let i = 0; i < mValue; i++) {
      tableData[i].BHValue = i / mValue * qValue;
    }

    this.setState({tableData})
  }

  componentWillMount() {
    QueryActions.setResultType(this.props.facet, resultTypes.get('distribution',{
      'facet.field' : this.props.facet
    }));
    this.unsubscribeFromSearchStore = searchStore.listen(searchState => this.handleSearchResults(searchState));
    this.unsubscribeFromBackgroundSetStore = backgroundSetStore.listen(bgsetState => this.handleBgSet(bgsetState));
  }

  componentWillUnmount() {
    QueryActions.removeResultType(this.props.facet);
    this.unsubscribeFromSearchStore();
    this.unsubscribeFromBackgroundSetStore();
  }
  buildHierarchy(docs) {
    let nodes = [];
    let edges = [];
    const nodeIdx = _.keyBy(docs, '_id');
    docs.forEach(d => {
      let result = {id: d._id, name: d.id, label: d.name, count: this.state.terms.data[d._id].count, definition: d.def || d.description};
      nodes.push({data: result});
      if(d.is_a) {
        d.is_a.forEach(e => {
          if (nodeIdx[e]) {
            edges.push({data: {source: d._id, target: e}});
          }
        })
      }
    });
    this.setState({nodes:nodes, edges: edges})
  }

  renderTable() { return (
    <ReactTable
      data={this.state.tableData}
      columns={[
        {
          Header: 'ID',
          accessor: 'name',
          width: 90
        },
        {
          Header: 'Enrichment',
          accessor: 'BHValue',
          Cell: row => (
            <span>{row.value.toFixed(3)}</span>
          ),
          style: {'text-align':'right'},
          width: 100
        },
        {
          Header: 'Genes',
          accessor: 'count',
          style: {'text-align':'right'},
          width: 100
        },
        {
          Header: 'Total',
          accessor: 'bgCount',
          style: {'text-align':'right'},
          width: 100
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
      defaultPageSize={this.state.tableData.length < 20 ? this.state.tableData.length : 20}
      showPagination={this.state.tableData.length > 20}
    />
  ) }

  renderGraph() {
    return (
      <CytoscapeComponent
        cy = {cy => {
          cy.layout({name: 'dagre', nodeDimensionsIncludeLabels: true, rankDir: 'BT'}).run();
          var makeTippy = function(node, data){
              return tippy( node.popperRef(), {
                content: function(){
                  var div = document.createElement('div');
                  div.innerHTML = 'ID: ' + data.id + '<br>Count: ' + data.count;
                  return div;
                },
                trigger: 'manual',
                arrow: true,
                placement: 'bottom',
                hideOnClick: false,
                sticky: true,
              } );
            };

          cy.nodes().forEach(n => {
              let tip = makeTippy(n, {id: n.data('id'), count: n.data('count')});
              n.on('tap',() => tip.show());
              cy.on('click', () => tip.hide());
          })

          this.cy = cy.fit();
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
            { this.state.tableData && this.renderTable() }
          </TabPanel>
          <TabPanel>
            { this.state.nodes && this.renderGraph() }
          </TabPanel>
        </Tabs>
      </div>
    );
  }
}
