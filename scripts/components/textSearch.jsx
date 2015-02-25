'use strict';

var React = require('react');
var _ = require('lodash');
var SearchActions = require('../actions/searchActions');

var TextSearch = React.createClass({
  handleChange: function() {
    var val = this.refs.searchBox.getDOMNode().value;
    SearchActions.setQueryString(val);
  },
  componentWillMount: function() {
    // only fire off queries every 500 ms.
    this.handleChange = _.debounce(this.handleChange, 500);
  },
  render: function(){
    return (
      <section className="search">
        <label htmlFor="searchBox">Search for Genes</label>
        <input ref="searchBox" type="text" onChange={this.handleChange} />
      </section>
    );
  }
});
module.exports = TextSearch;