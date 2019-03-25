'use strict';

import React from 'react';
import ResultsList from './resultsList.jsx';
import ResultsVisualization from './resultsVisualization.jsx';
import Fireworks from './Fireworks.jsx';
import Downloads from './downloads.jsx';
import Ontology from './Ontology.jsx';
import SummaryCount from "../search/SummaryCount.jsx";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
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
          key: 'taxon_id.count'
        },
        {
          name: "Pathways",
          active: false,
          component: Fireworks,
          key: 'pathways.count'
        },
        {
          name: "Domains",
          active: false,
          component: Ontology,
          key: 'domains.count'
        },
        {
          name: "GO Terms",
          active: false,
          component: Ontology,
          key: 'GO.count'
        },
        {
          name: "PO Terms",
          active: false,
          component: Ontology,
          key: 'PO.count'
        },
        {
          name: "Genes",
          default: true,
          active: true,
          component: ResultsList,
          key: 'metadata.count'
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
      'facet.field' : 'taxon_id'
    }));
    QueryActions.setResultType('domains', resultTypes.get('distribution',{
      'facet.field' : 'domains__ancestors',
      key: 'domains'
    }));
    QueryActions.setResultType('GO', resultTypes.get('distribution',{
      'facet.field' : 'GO__ancestors',
      key: 'GO'
    }));
    QueryActions.setResultType('PO', resultTypes.get('distribution',{
      'facet.field' : 'PO__ancestors',
      key: 'PO'
    }));
    QueryActions.setResultType('pathways', resultTypes.get('distribution',{
      'facet.field' : 'pathways__ancestors',
      key: 'pathways'
    }));

    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
      this.setState({search: searchState})
    );
  }
  componentWillUnmount() {
    QueryActions.removeResultType('species');
    QueryActions.removeResultType('domains');
    QueryActions.removeResultType('GO');
    QueryActions.removeResultType('PO');
    QueryActions.removeResultType('pathways');
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
    let key = this.state.resultModes[idx].key;
    if (key) {
      let results = this.state.search ? this.state.search.results : undefined;

      return <span style={{float:'right', textAlign:'right', marginLeft:'50px'}}><SummaryCount results={results} path={key}/></span>
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
                    {React.createElement(mode.component)}
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
