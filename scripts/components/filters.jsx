'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var FilterPickers = require('./filterPickers.jsx');

var staticFilters = [
  {name: 'Species', count: 38},
  {name: 'Domain', count: 65376},
  {name: 'GO', count: 6750},
  {name: 'Other'}
];

var Filters = React.createClass({
  getInitialState: function() {
    return {
      selectedFilter: undefined
    };
  },
  selectFilter: function(name) {
    return function() {
      this.setState({selectedFilter: name})
    }.bind(this);
  },
  render: function(){
    var selectedFilter = this.state.selectedFilter;
    var listItems = staticFilters.map(function(filter) {
      var active = filter.name === selectedFilter;
      var badge;
      if(filter.count !== 'undefined') {
        badge = (
          <bs.Badge>{filter.count}</bs.Badge>
        );
      }
      return (
        <bs.ListGroupItem
            className="filter-item"
            key={filter.name}
            active={active}
            onClick={this.selectFilter(filter.name)}>
          {filter.name}
          {badge}
        </bs.ListGroupItem>
      );
    }.bind(this));

    return (
      <bs.Well className="filters">
        <bs.Row>
          <bs.Col xs={12} md={4}>
            <bs.ListGroup className="filter-chooser">
              {listItems}
            </bs.ListGroup>
          </bs.Col>
          <bs.Col xs={12} md={8}>
            <h1>Do some filtering{selectedFilter ? ' of ' + selectedFilter : ''} here!</h1>
            <p>This is where the filter UI would go</p>
          </bs.Col>
        </bs.Row>
      </bs.Well>
    );
  }
});

module.exports = Filters;