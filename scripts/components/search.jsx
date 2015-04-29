'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');
var filters = require('../config/filters');

var SearchSummary = require('./searchSummary.jsx');
var Suggest = require('./suggest.jsx');

var bs = require('react-bootstrap');
var Nav = bs.Nav,
  Button = bs.Button,
  Input = bs.Input;

var TextSearch = React.createClass({
  propTypes: {
    search: React.PropTypes.object.isRequired,
    onFilterButtonPress: React.PropTypes.func
  },
  getInitialState: function() {
    return {
      typeaheadVisible: false
    };
  },
  handleQueryChange: function(e) {
    var node = this.refs.searchBox.getDOMNode();
    // required for testing.
    if(e.target.value !== node.value) {
      node.value = e.target.value;
    }
    var queryString = node.value;
    QueryActions.setQueryString(queryString);

    // For now, show typeahead if query string is not empty
    this.setState({
      typeaheadVisible: !!queryString.length
    });
  },
  inputLostFocus: function() {
    this.setState({
      typeaheadVisible: false
    });
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

    var typeahead;
    if(this.state.typeaheadVisible) {
      typeahead = (
        <Suggest queryString={this.props.search.query.q} />
      );
    }

    return (
      <Nav right={true} className="search-box-nav">
        <Input type="search"
               ref="searchBox"
               placeholder="Search for genes…"
               standalone={true}
               addonAfter={resultsCountStatement}
               buttonAfter={filterDropdown}
               onChange={this.handleQueryChange}
               onBlur={this.inputLostFocus} />
        {typeahead}
      </Nav>
    );
  }
});
module.exports = TextSearch;