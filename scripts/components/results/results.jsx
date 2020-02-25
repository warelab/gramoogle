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
          available: true,
          active: true,
          default: true,
          component: ResultsVisualization,
          key: 'species',
          tally: 'taxon_id',
          path: 'taxon_id.count'
        },
        {
          name: "Pathways",
          available: false,
          active: false,
          component: Fireworks,
          key: 'pathways',
          tally: 'pathways__xrefi',
          path: 'pathways.count'
        },
        {
          name: "Domains",
          available: true,
          active: false,
          component: Ontology,
          key: 'domains',
          facet: 'domains__ancestors',
          tally: 'domains__xrefi',
          path: 'domains.count',
          collection: 'domains'
        },
        {
          name: "GO Terms",
          available: true,
          active: false,
          component: Ontology,
          key: 'GO',
          facet: 'GO__ancestors',
          tally: 'GO__xrefi',
          path: 'GO.count',
          collection: 'GO'
        },
        {
          name: "PO Terms",
          available: false,
          active: false,
          component: Ontology,
          key: 'PO',
          facet: 'PO__ancestors',
          tally: 'PO__xrefi',
          path: 'PO.count',
          collection: 'PO'
        },
        {
          name: "Genes",
          default: true,
          available: true,
          active: true,
          component: ResultsList,
          path: 'metadata.count'
        },
        {
          name: "-> Download",
          available: false,
          active: false,
          component: Downloads,
          exclusive: true
        }
      ]
    };
  }

  componentWillMount() {
    this.state.resultModes.forEach(mode => {
      if (mode.available && mode.tally) {
        QueryActions.setResultType(mode.key, resultTypes.get('distribution',{
          key : mode.key,
          'facet.field' : mode.tally
        }))
      }
    });

    this.unsubscribeFromSearchStore = searchStore.listen((searchState) => {
      if (searchState.results.species) {
        let s = searchState.results.species.sorted.map(s => +s.id);
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
    this.state.resultModes.forEach(mode => {
      if (mode.available && mode.tally) {
        QueryActions.removeResultType(mode.key);
        if (mode.facet) {
          BackgroundSetActions.removeResultType(mode.key);
        }
      }
    });
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

  renderSidebar() {
    return (
      <div role="group" className="btn-group-vertical" style={{padding:"10px"}}>
        {
          this.state.resultModes.map((mode,idx) => {
            if (mode.available) {
              return (
                <button key={idx} className={this.css(idx)} onClick={() => this.toggleMode(idx)}>
                  <span><span style={{float:'left', textAlign:'left'}}>{mode.name}</span>{this.tally(idx)}</span>
                </button>
              )
            }
          })
        }
      </div>
    )
  }


  render() {
    return (
      <section className="results">
        <div className="row">
          <div className="main col-sm-10">
            {
              this.state.resultModes.map((mode,idx) => {
                if (mode.active && mode.available) {
                  return (
                    <div style={{padding:10}} key={idx}>
                      {React.createElement(mode.component, mode)}
                    </div>
                  )
                }
              })
            }
          </div>
          <div className="sidenav col-sm-2">
            {this.renderSidebar()}
          </div>
        </div>
      </section>
    );
  }
}
