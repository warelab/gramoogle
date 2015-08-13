'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');

var analysisInventory = require('./analysisInterfaces/_inventory');

var QueryActions = require('../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;

var resultType = resultTypes.get('tally');

var AnalysisListItem = React.createClass({
  propTypes: {
    analysis: React.PropTypes.object.isRequired,
    selected: React.PropTypes.object,
    tally: React.PropTypes.number,
    onSelect: React.PropTypes.func.isRequired
  },
  render: function() {
    var selectedAnalysis = this.props.selected,
        analysis = this.props.analysis,
        tally = this.props.tally,
        active = selectedAnalysis && analysis.name === selectedAnalysis.name,
        className = 'analysis-item' + (analysis.filters.length ? ' analysis-item-filtered' : ''),
        badge = (
            <bs.Badge>{tally}</bs.Badge>
          );

    return (
      <bs.ListGroupItem
        className={className}
        key={analysis.name}
        active={active}
        onClick={this.props.onSelect}>
        {analysis.name}
        {badge}
      </bs.ListGroupItem>
    );
  }
});

var Analysis = React.createClass({
  getInitialState: function() {
    return {
      selectedAnalysisName: undefined
    };
  },
  selectAnalysis: function(name) {
    return function selectNamedAnalysis() {
      this.setState({
        selectedAnalysisName: name
      });
    }.bind(this);
  },
  componentWillMount: function () {
    QueryActions.setResultType('tally', resultType);
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType('tally');
  },
  cloneAnalysisInventoryWithFiltersAdded: function() {
    var filters = this.props.search.query.filters;
    return _.chain(analysisInventory)
      .cloneDeep()
      .forOwn(function(analysis) {
        analysis.filters = _.filter(filters, function(obj, key) {
          return _.contains(key, analysis.queryField);
        })
      })
      .value();
  },
  render: function(){
    var search = this.props.search,
        tally = search.results.tally,
        analyses = this.cloneAnalysisInventoryWithFiltersAdded(),
        selectedAnalysis = analyses[this.state.selectedAnalysisName],
        analysisDetailComponent;

    if(!tally) {
      return (
        <img src="images/charlie.jpg"/>
      )
    }

    if(selectedAnalysis) {
      analysisDetailComponent = React.createElement(
        selectedAnalysis.reactClass,
        {
          search: search,
          metadata: selectedAnalysis
        }
      );
    }

    var listItems = _.map(analyses, function(analysis) {
      return (
        <AnalysisListItem
          key={analysis.field}
          search={search}
          analysis={analysis}
          selected={selectedAnalysis}
          tally={tally[analysis.field]}
          onSelect={this.selectAnalysis(analysis.name)}/>
      );
    }.bind(this));

    return (
      <bs.Well className="analysis">
        <bs.Row>
          <bs.Col xs={12} md={4}>
            <bs.ListGroup className="analysis-chooser">
              {listItems}
            </bs.ListGroup>
          </bs.Col>
          <bs.Col xs={12} md={8}>
            {analysisDetailComponent}
          </bs.Col>
        </bs.Row>
      </bs.Well>
    );
  }
});

module.exports = Analysis;