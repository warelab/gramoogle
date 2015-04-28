'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var FilterPickers = require('./filterPickers.jsx');
var _ = require('lodash');

var filterInventory = require('./filterInterfaces/_inventory');

var Filters = React.createClass({
  getInitialState: function() {
    return {
      selectedFilter: undefined
    };
  },
  selectFilter: function(name) {
    return function() {
      this.setState({
        selectedFilter: filterInventory[name]
      });
    }.bind(this);
  },
  render: function(){
    var selectedFilter = this.state.selectedFilter;
    var filter;
    if(selectedFilter) {
      filter = React.createElement(selectedFilter.reactClass, {search: this.props.search});
    }

    var listItems = _.map(filterInventory, function(filter) {
      var active = selectedFilter && filter.name === selectedFilter.name;
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
            {filter}
          </bs.Col>
        </bs.Row>
      </bs.Well>
    );
  }
});

module.exports = Filters;