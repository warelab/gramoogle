'use strict';

var React = require('react');
var ResultsList = require('./resultsList.jsx');
var ResultsVisualization = require('./resultsVisualization.jsx');

var bs = require('react-bootstrap');

var Results = React.createClass({
  getInitialState: function () {
    return {viz: true, list: false};
  },
  VIZ: 'viz',
  LIST: 'list',
  toggleViz: function() {
    var newState = {
      viz: !this.state.viz
    };
    this.setState(newState);
  },
  toggleList: function() {
    var newState = {
      list: !this.state.list
    };
    this.setState(newState);
  },
  render: function () {
    var theViz, theList;
    if(this.state.viz) {
      theViz = (<ResultsVisualization results={this.props.results}/>);
    }
    if(this.state.list) {
      theList = (<ResultsList results={this.props.results}/>);
    }

    return (
      <section className="results">
        <bs.ButtonGroup vertical className="pull-right">
          <bs.Button ref="viz-button"
              active={this.state.viz}
              onClick={this.toggleViz}>
            Distribution
          </bs.Button>
          <bs.Button ref="list-button"
              active={this.state.list}
              onClick={this.toggleList}>
            List of Results
          </bs.Button>
        </bs.ButtonGroup>
      {theViz}
      {theList}
      </section>
    );
  }
});
module.exports = Results;