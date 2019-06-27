'use strict';

import React from 'react';
import ResultsList from './resultsList.jsx';
import ResultsVisualization from './resultsVisualization.jsx';
import Fireworks from './Fireworks.jsx';
import Downloads from './downloads.jsx';
import Ontology from './Ontology.jsx';
import DomainsTable from './DomainsTable.jsx';
import SummaryCount from "../search/SummaryCount.jsx";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
import BackgroundSetActions from "../../actions/backgroundSetActions";
import searchStore from "../../stores/searchStore";

export default class Results extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      resultModes: [
        {
          name: "Species",
          active: false,
          component: ResultsVisualization,
          path: 'taxon_id.count'
        },
        {
          name: "Pathways",
          active: false,
          component: Fireworks,
          path: 'pathways.count'
        },
        {
          name: "Domains",
          active: false,
          component: Ontology,
          facet: 'domains__ancestors',
          path: 'domains.count',
          collection: 'domains'
        },
        {
          name: "GO Terms",
          active: false,
          component: Ontology,
          facet: 'GO__ancestors',
          path: 'GO.count',
          collection: 'GO'
        },
        {
          name: "PO Terms",
          active: false,
          component: Ontology,
          facet: 'PO__ancestors',
          path: 'PO.count',
          collection: 'PO'
        },
        {
          name: "Genes",
          default: true,
          active: true,
          component: ResultsList,
          path: 'metadata.count'
        },
        {
          name: "-> Download",
          active: false,
          component: Downloads,
          exclusive: true
        }
      ]
    };
  }

  componentWillMount() {
    QueryActions.setResultType('species', resultTypes.get('distribution',{
      'key':'species',
      // 'facet.limit' : 101,
      'facet.field' : 'taxon_id'
    }));
    QueryActions.setResultType('domains', resultTypes.get('distribution',{
      'facet.field' : 'domains__xrefi',
      // 'facet.limit' : 101,
      key: 'domains'
    }));
    QueryActions.setResultType('GO', resultTypes.get('distribution',{
      'facet.field' : 'GO__xrefi',
      // 'facet.limit' : 101,
      key: 'GO'
    }));
    QueryActions.setResultType('PO', resultTypes.get('distribution',{
      'facet.field' : 'PO__xrefi',
      // 'facet.limit' : 101,
      key: 'PO'
    }));
    QueryActions.setResultType('pathways', resultTypes.get('distribution',{
      'facet.field' : 'pathways__xrefi',
      // 'facet.limit' : 101,
      key: 'pathways'
    }));

    this.unsubscribeFromSearchStore = searchStore.listen((searchState) => {
      console.log('results.jsx got searchState', searchState);
      if (searchState.results.species) {
        let s = searchState.results.species.sorted.map(s => +s.id);
        console.log('need only these',s);
        BackgroundSetActions.setTaxa(s);
        BackgroundSetActions.setResultType('GO__ancestors', resultTypes.get('distribution',{
          'key':'GO__ancestors',
          'facet.field' : 'GO__ancestors'
        }));
        BackgroundSetActions.setResultType('domains__ancestors', resultTypes.get('distribution',{
          'key':'domains__ancestors',
          'facet.field' : 'domains__ancestors'
        }));
        BackgroundSetActions.setResultType('PO__ancestors', resultTypes.get('distribution',{
          'key':'PO__ancestors',
          'facet.field' : 'PO__ancestors'
        }));
      }
      this.setState({search: searchState});
    });
  }
  componentWillUnmount() {
    QueryActions.removeResultType('species');
    QueryActions.removeResultType('domains');
    QueryActions.removeResultType('GO');
    QueryActions.removeResultType('PO');
    QueryActions.removeResultType('pathways');
    BackgroundSetActions.removeResultType('domains');
    BackgroundSetActions.removeResultType('GO');
    BackgroundSetActions.removeResultType('PO');
    this.unsubscribeFromSearchStore();
  }

  css(idx) {
    return this.state.resultModes[idx].active ?
      "btn btn-primary" : "btn btn-outline-primary"
  }

  toggleMode(idx) {
    let resultModes = this.state.resultModes;
    resultModes[idx].active = ! resultModes[idx].active;
    if (resultModes[idx].exclusive && resultModes[idx].active) {
      // turn off all other modes
      resultModes.forEach((mode,i)=> {
        if (i !== idx) {
          mode.active = false;
        }
      })
    }
    else if (resultModes[idx].exclusive) { // just turned off an exclusive mode
      // turn on the default modes
      resultModes.forEach((mode,i) => {
        if (mode.default) {
          mode.active = true;
        }
      })
    }
    else {
      // make sure all of the exclusive modes are off
      resultModes.forEach((mode,i) => {
        if (mode.exclusive && mode.active) {
          mode.active = false;
        }
      })
    }
    this.setState(resultModes);
  }

  tally(idx) {
    let path = this.state.resultModes[idx].path;
    if (path) {
      let results = this.state.search ? this.state.search.results : undefined;

      return <span style={{float:'right', textAlign:'right', marginLeft:'50px'}}><SummaryCount results={results} path={path}/></span>
    }
  }

  render() {
    return (
      <section className="results container">
        <div className="sidenav">
          <div role="group" className="btn-group-vertical" style={{padding:"10px"}}>
            {
              this.state.resultModes.map((mode,idx) =>
                <button key={idx} className={this.css(idx)} onClick={() => this.toggleMode(idx)}>
                  <span><span style={{float:'left', textAlign:'left'}}>{mode.name}</span>{this.tally(idx)}</span>
                </button>
              )
            }
          </div>
        </div>
        <div className="main">
          {
            this.state.resultModes.map((mode,idx) => {
              if (mode.active) {
                return (
                  <div key={idx}>
                    {React.createElement(mode.component,mode)}
                  </div>
                )
              }
            })
          }
        </div>
      </section>
    );
  }
}
