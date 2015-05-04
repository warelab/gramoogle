'use strict';

var React = require('react');
var Reflux = require('reflux');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');
var filters = require('../config/filters');

var SearchSummary = require('./searchSummary.jsx');
var Suggest = require('./suggest.jsx');

var constants = require('../config/constants');
var bs = require('react-bootstrap');
var Nav = bs.Nav,
  Button = bs.Button,
  Input = bs.Input;

var TextSearch = React.createClass({
  mixins: [Reflux.ListenerMixin],
  propTypes: {
    search: React.PropTypes.object.isRequired,
    onFilterButtonPress: React.PropTypes.func
  },
  getInitialState: function() {
    return {
      suggestionsVisible: false
    };
  },
  componentDidMount: function() {
    // listen directly to an action method.

    // Why?

    // If we bind the search input's value to the query string state
    // then it is updated when the search response comes back

    // then it's really hard to use. So it's disconnected from the rest
    // of app state and we must manually clear it here if the query string is
    // removed (e.g. when a suggestion is picked)
    this.listenTo(QueryActions.removeQueryString, this.clearInputString);
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
      suggestionsVisible: !!queryString.length
    });
  },
  inputLostFocus: function() {
    //this.setState({
    //  suggestionsVisible: false
    //});
  },
  inputGainedFocus: function() {
    this.setState({
      suggestionsVisible: !!this.props.search.query.q.length
    });
  },
  clearInputString: function() {
    this.refs.searchBox.getInputDOMNode().value = '';
    this.setState({
      suggestionsVisible: false
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

    var suggestions;
    if(this.state.suggestionsVisible) {
      suggestions = (
        <Suggest queryString={this.props.search.query.q}/>
      );
    }

    var filters = _.map(search.query.filters, function(filter, fq) {
      return (
        <div className="filterLozenge">${filter}</div>
      )
    });

    return (
      <Nav right={true}
           className="search-box-nav"
           onFocus={this.inputGainedFocus}
           onBlur={this.inputLostFocus}>
        <Input type="search"
               ref="searchBox"
               placeholder="Search for genes…"
               standalone={true}
               addonAfter={resultsCountStatement}
               buttonAfter={filterDropdown}
               onChange={this.handleQueryChange}
          />
        {filters}
        {suggestions}
      </Nav>
    );
  }
});
module.exports = TextSearch;