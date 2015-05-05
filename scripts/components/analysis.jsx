'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var AnalysisPickers = require('./analysisPickers.jsx');
var _ = require('lodash');

var analysisInventory = require('./analysisInterfaces/_inventory');

var QueryActions = require('../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;

var resultType = resultTypes.get('tally');

var Analysis = React.createClass({
  getInitialState: function() {
    return {
      selectedAnalysis: undefined
    };
  },
  selectAnalysis: function(name) {
    return function() {
      this.setState({
        selectedAnalysis: analysisInventory[name]
      });
    }.bind(this);
  },
  componentWillMount: function () {
    QueryActions.setResultType('tally', resultType);
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType('tally');
  },
  render: function(){
    var tally = this.props.search.results.tally;
    if(!tally) {
      return (
        <img src="images/charlie.jpg"/>
      )
    }
    
    var selectedAnalysis = this.state.selectedAnalysis;
    var analysis;
    if(selectedAnalysis) {
      analysis = React.createElement(selectedAnalysis.reactClass, {search: this.props.search});
    }

    var listItems = _.map(analysisInventory, function(analysis) {
      var active = selectedAnalysis && analysis.name === selectedAnalysis.name;
      var badge = (
        <bs.Badge>{tally[analysis.field]}</bs.Badge>
      );
      return (
        <bs.ListGroupItem
            className="analysis-item"
            key={analysis.name}
            active={active}
            onClick={this.selectAnalysis(analysis.name)}>
          {analysis.name}
          {badge}
        </bs.ListGroupItem>
      );
    }, this);

    return (
      <bs.Well className="analysis">
        <bs.Row>
          <bs.Col xs={12} md={4}>
            <bs.ListGroup className="analysis-chooser">
              {listItems}
            </bs.ListGroup>
          </bs.Col>
          <bs.Col xs={12} md={8}>
            {analysis}
          </bs.Col>
        </bs.Row>
      </bs.Well>
    );
  }
});

module.exports = Analysis;