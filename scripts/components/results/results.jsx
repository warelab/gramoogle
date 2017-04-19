'use strict';

import React from 'react';
import {Tabs, Tab} from 'react-bootstrap';
import ResultsList from './resultsList.jsx';
import ResultsVisualization from './resultsVisualization.jsx';
import Fireworks from './Fireworks.jsx';

export default class Results extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      summary: 'taxagenomic',
      list: true
    };
  }

  render() {
    let viz, pathways;
    if (this.state.summary === 'taxagenomic')
      viz = (<ResultsVisualization results={this.props.results}/>);
    if (this.state.summary === 'pathways')
      pathways = (<Fireworks results={this.props.results}/>);
    return (
      <section className="results container">
        <div>
          <Tabs activeKey={this.state.summary}
                animation={false}
                unmountOnExit={true}
                bsStyle='tabs'
                onSelect={(summary) => this.setState({summary})}
                id="results-summary-tabs">
            <Tab eventKey='taxagenomic' title="Taxagenomic distribution">{viz}</Tab>
            {/*<Tab eventKey='pathways' title="Pathways distribution">{pathways}</Tab>*/}
          </Tabs>
          <ResultsList results={this.props.results}/>
        </div>
      </section>
    );
  }
}
