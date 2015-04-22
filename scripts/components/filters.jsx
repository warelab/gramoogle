'use strict';

var React = require('react');
var FilterPickers = require('./filterPickers.jsx');

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
        <FilterPickers filters={this.props.query.filters}
                       results={this.props.results} />
      );
    } else {
      contents = (
        <span></span>
        //<FilterSummary filters={this.props.query.filters}
        //               results={this.props.results} />
      );
    }
    return (
      <div className="filters">
        <button onClick={this.toggleDisplayState}>Filter</button>
        {contents}
      </div>
    );
  }
});
module.exports = Filters;