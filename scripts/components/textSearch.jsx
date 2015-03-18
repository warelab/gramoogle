'use strict';

var React = require('react');
var SearchActions = require('../actions/searchActions');
var _ = require('lodash');
var filters = require('../config/filters');

var TextSearch = React.createClass({
  handleChange: function(e) {
    var node = this.refs.searchBox.getDOMNode();
    // required for testing.
    if(e.target.value != node.value) {
      node.value = e.target.value;
    }
    var queryString = node.value;
    SearchActions.setQueryString(queryString);
  },
  render: function(){
    return (
      <section className="search">
        <label htmlFor="searchBox">Search for Genes</label>
        <input ref="searchBox" type="text" defaultValue={this.props.search.queryString} onChange={this.handleChange} />
      </section>
    );
  }
});
module.exports = TextSearch;