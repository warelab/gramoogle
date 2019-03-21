'use strict';

import React from 'react';
import ResultsList from './resultsList.jsx';
import ResultsVisualization from './resultsVisualization.jsx';
import Fireworks from './Fireworks.jsx';
import Downloads from './downloads.jsx';
import _ from "lodash";
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
          key: 'taxon_id'
        },
        {
          name: "Pathways",
          active: false,
          component: Fireworks
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
          key: 'metadata'
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

    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
      this.setState({search: searchState.results})
    );
  }
  componentWillUnmount() {
    QueryActions.removeResultType('species');
    QueryActions.removeResultType('biotype');
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
    if (this.state.search && this.state.search.hasOwnProperty(this.state.resultModes[idx].key)) {
      return this.state.search[this.state.resultModes[idx].key].count;
    }
  }

  render() {
    return (
      <section className="results container">
        <div>
          <div className="sidenav">
            {
              this.state.resultModes.map((mode,idx) =>
                <a key={idx} className={this.css(idx)} onClick={() => this.toggleMode(idx)}>{mode.name}{this.tally(idx)}</a>
              )
            }
          </div>
          <div className="main">
            {
              this.state.resultModes.map(mode => {
                if (mode.active) {
                  return (
                    <div>
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
