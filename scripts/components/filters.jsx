'use strict';

var React = require('react');
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
    if(!this.state.expanded) {
      contents = (
        <p>Filter summary</p>
      )
    }
    else {
      contents = (
        <ol>
          <li>Detailed</li>
          <li>Information</li>
          <li>About</li>
          <li>The</li>
          <li>Filters</li>
        </ol>
      )
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