'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');
var filters = require('../config/filters');

var SearchSummary = require('./searchSummary.jsx');

var bs = require('react-bootstrap');
var Nav = bs.Nav,
  Button = bs.Button,
  Input = bs.Input;

var TextSearch = React.createClass({
  propTypes: {
    search: React.PropTypes.object.isRequired,
    onFilterButtonPress: React.PropTypes.func
  },
  handleQueryChange: function(e) {
    var node = this.refs.searchBox.getDOMNode();
    // required for testing.
    if(e.target.value != node.value) {
      node.value = e.target.value;
    }
    var queryString = node.value;
    QueryActions.setQueryString(queryString);
  },
  render: function(){
    var search = this.props.search;

    var resultsCountStatement = (
      <SearchSummary results={search.results} />
    );

    var filterDropdown = (
      <Button onClick={this.props.onFilterButtonPress}>
        Filter <span className="caret"></span>
      </Button>
    );

    return (
      <Nav right={true} className="search-box-nav">
        <Input className="foo"
               type="search"
               ref="searchBox"
               placeholder="Search for genes…"
               standalone={true}
               addonAfter={resultsCountStatement}
               buttonAfter={filterDropdown}
               onChange={this.handleQueryChange} />
      </Nav>
    );
  }
});
module.exports = TextSearch;