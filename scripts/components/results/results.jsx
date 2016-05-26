'use strict';

var React = require('react');
var ResultsList = require('./resultsList.jsx');
var ResultsVisualization = require('./resultsVisualization.jsx');
var mq = require('../../config/mq');

var bs = require('react-bootstrap');

var Results = React.createClass({
  getInitialState: function () {
    return {
      viz: this.shouldShowVis(),
      list: true
    };
  },
  shouldShowVis: function(props) {
    return true;
  },
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
  componentWillReceiveProps: function(newProps) {
    this.setState({
      viz: this.shouldShowVis(newProps)
    });
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
        <div>
          {theViz}
          {theList}
        </div>
      </section>
    );
  }
});
module.exports = Results;