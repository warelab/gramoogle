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
          active: true,
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
          name: "-> Download",
          active: false,
          component: Downloads
        },
        {
          name: "Genes",
          active: true,
          component: ResultsList,
          key: 'metadata.count'
        }
      ]
    };
  }

  componentWillMount() {
    QueryActions.setResultType('species', resultTypes.get('distribution',{
      'key':'species',
      'facet.field' : 'taxon_id'
    }));
    QueryActions.setResultType('biotype', resultTypes.get('distribution',{
      'facet.field' : 'biotype'
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
    QueryActions.removeResultType('biotype');
    QueryActions.removeResultType('domains');
    QueryActions.removeResultType('GO');
    QueryActions.removeResultType('PO');
    QueryActions.removeResultType('pathways');
    this.unsubscribeFromSearchStore();
  }

  css(idx) {
    return this.state.resultModes[idx].active ?
      "result-mode active" : "result-mode"
  }

  toggleMode(idx) {
    let resultModes = this.state.resultModes;
    resultModes[idx].active = ! resultModes[idx].active;
    this.setState(resultModes);
  }

  tally(idx) {
    let key = this.state.resultModes[idx].key;
    if (key) {
      let results = this.state.search ? this.state.search.results : undefined;

      return <span style={{fontSize:'smaller'}}><SummaryCount results={results} path={key}/></span>
    }
  }

  render() {
    return (
      <section className="results container">
        <div>
          <div className="sidenav">
            {
              this.state.resultModes.map((mode,idx) =>
                <div key={idx}>
                  <a className={this.css(idx)} onClick={() => this.toggleMode(idx)}>
                    <span style={{textAlign:'left'}}>{mode.name}</span>
                    <span style={{textAlign:'right',float:'right'}}>{this.tally(idx)}</span>
                  </a>
                </div>
              )
            }
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
        </div>
      </section>
    );
  }
}
