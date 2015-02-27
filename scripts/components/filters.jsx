'use strict';

var React = require('react');
var FilterSummary = require('./filtersSummary.jsx');
var FilterPickers = require('./filterPickers.jsx');
//var SearchActions = require('../actions/searchActions');

var Filters = React.createClass({
  getInitialState: function() {
    return { expanded: false };
  },
  toggleDisplayState: function() {
    this.setState({ expanded: !this.state.expanded });
  },
  render: function(){
    var contents;
    if(this.state.expanded) {
      contents = (
        <FilterPickers />
      );
    } else {
      contents = (
        <FilterSummary />
      );
    }
    return (
      <section className="filters">
        <h4>Filters</h4><button onClick={this.toggleDisplayState}>{this.state.expanded ? "Contract" : "Expand" }</button>
        {contents}
      </section>
    );
  }
});
module.exports = Filters;