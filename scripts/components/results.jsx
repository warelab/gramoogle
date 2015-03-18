'use strict';

var React = require('react');
var ResultsList = require('./resultsList.jsx');
var ResultsVisualization = require('./resultsVisualization.jsx');

var Results = React.createClass({
  getInitialState: function () {
    return {visible: this.VIZ};
  },
  VIZ: 'viz',
  LIST: 'list',
  updateView: function (e) {
    this.setState({visible: e.target.value});
  },
  render: function () {
    var view;
    if(this.state.visible === this.VIZ) {
      view = (<ResultsVisualization results={this.props.results}/>);
    } else {
      view = (<ResultsList results={this.props.results}/>);
    }

    return (
      <section className="results">
        <h4>Results</h4>
        <form>
          <input type="radio" name="resultView" value={this.VIZ} checked={this.state.visible === this.VIZ} onChange={this.updateView}>Result Distribution</input>
          <input type="radio" name="resultView" value={this.LIST} checked={this.state.visible === this.LIST} onChange={this.updateView}>List of Results</input>
        </form>
      {view}
      </section>
    );
  }
});
module.exports = Results;