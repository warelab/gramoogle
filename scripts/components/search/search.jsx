'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');

var Nav = require('react-bootstrap').Nav;

var QueryActions = require('../../actions/queryActions');

var Suggest = require('../suggest/suggest.jsx');
var SearchBox = require('./searchBox.jsx');
var Filters = require('./filters.jsx');

var Search = React.createClass({
  mixins: [Reflux.ListenerMixin],
  propTypes: {
    search: React.PropTypes.object.isRequired,
    onAnalysisButtonPress: React.PropTypes.func.isRequired
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
    var queryString = e.target.value;

    QueryActions.setQueryString(queryString);

    // For now, show typeahead if query string is not empty
    this.setState({
      suggestionsVisible: !!queryString.length
    });
  },
  clearInputString: function() {
    this.refs.searchBox.clearSearchString();
    this.setState({
      suggestionsVisible: false
    });
  },
  render: function(){
    var suggestions,
      filters,
      search = this.props.search;

    if(this.state.suggestionsVisible) {
      suggestions = (
        <Suggest queryString={this.props.search.query.q}/>
      );
    }

    if(_.size(search.query.filters)) {
      filters = (
        <Filters filters={search.query.filters} />
      );
    }

    return (
      <Nav pullRight
           className="search-box-nav">
        <SearchBox ref="searchBox"
                   results={search.results}
                   onQueryChange={this.handleQueryChange}
                   onStatsButtonPress={this.props.onAnalysisButtonPress} />
        {filters}
        {suggestions}
      </Nav>
    );
  }
});

module.exports = Search;
