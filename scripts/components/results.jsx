'use strict';

var React = require('react');
var ResultsList = require('./resultsList.jsx');
var ResultsVisualization = require('./resultsVisualization.jsx');
var mq = require('../config/mq');

var bs = require('react-bootstrap');

var Results = React.createClass({
  getInitialState: function () {
    return {
      viz: mq.isLargeScreen() && this.shouldShowVis(),
      list: true
    };
  },
  shouldShowVis: function(props) {
    props = props || this.props;
    return props.results.metadata.count > 1;
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
      viz: mq.isLargeScreen() && this.shouldShowVis(newProps)
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