'use strict';

var React = require('react');
var ResultsList = require('./resultsList.jsx');
var ResultsVisualization = require('./resultsVisualization.jsx');

var Results = React.createClass({
  getInitialState: function () {
    return {visible: 'viz'};
  },
  updateView: function (e) {
    this.setState({visible: e.target.value});
  },
  render: function () {
    var view = this.state.visible === 'viz' ? <ResultsVisualization /> : <ResultsList />;
    return (
      <section className="results">
        <h4>Results</h4>
        <form>
          <input type="radio" name="resultView" value='viz' checked={this.state.visible === 'viz'} onChange={this.updateView}>Result Distribution</input>
          <input type="radio" name="resultView" value='list' checked={this.state.visible === 'list'} onChange={this.updateView}>List of Results</input>
        </form>
      {view}
      </section>
    );
  }
});
module.exports = Results;