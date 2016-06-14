'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');

import {Nav} from "react-bootstrap";
import SearchBox from "./searchBox.jsx";
import SearchHelpPopover from "../welcome/SearchHelpPopover.jsx";

var QueryActions = require('../../actions/queryActions');

var Suggest = require('../suggest/suggest.jsx');
var Filters = require('./filters.jsx');


var Search = React.createClass({
  mixins: [Reflux.ListenerMixin],
  propTypes: {
    search: React.PropTypes.object.isRequired,
  },
  getInitialState: function () {
    return {
      suggestionsVisible: false,
      shouldShowTooltipIfWeGainFocus: true,
      isFocused: false
    };
  },
  componentDidMount: function () {
    // listen directly to an action method.

    // Why?

    // If we bind the search input's value to the query string state
    // then it is updated when the search response comes back

    // then it's really hard to use. So it's disconnected from the rest
    // of app state and we must manually clear it here if the query string is
    // removed (e.g. when a suggestion is picked)
    this.listenTo(QueryActions.removeQueryString, this.clearInputString);
  },
  handleQueryChange: function (e) {
    var queryString = e.target.value;

    QueryActions.setQueryString(queryString);

    // For now, show typeahead if query string is not empty
    this.setState({
      suggestionsVisible: !!queryString.length,
      shouldShowTooltipIfWeGainFocus: false
    });
  },
  handleFocus: function () {
    this.setState({isFocused: true})
  },
  handleClick: function () {
    // if we are already focused and the user clicks, show the tooltip
    if (this.state.isFocused) {
      this.setState({
        shouldShowTooltipIfWeGainFocus: true
      });
    }
  },
  handleBlur: function () {
    this.setState({isFocused: false})
  },
  clearInputString: function () {
    this.refs.searchBox.clearSearchString();
    this.setState({
      suggestionsVisible: false
    });
  },
  render: function () {
    var search = this.props.search;

    return (
        <Nav pullRight
             className="search-box-nav"
             onFocus={this.handleFocus}
             onBlur={this.handleBlur}
             onClick={this.handleClick}>
          <SearchBox ref="searchBox"
                     results={search.results}
                     onQueryChange={this.handleQueryChange}>

            {this.renderPopover()}
          </SearchBox>

          {this.renderFilters()}
          {this.renderSuggestions()}
        </Nav>
    );
  },
  renderSuggestions: function () {
    if (this.state.suggestionsVisible) {
      return <Suggest queryString={this.props.search.query.q}/>;
    }
  },
  shouldShowFilters: function () {
    return _.size(this.props.search.query.filters);
  },
  renderFilters: function () {
    if (this.shouldShowFilters()) {
      return <Filters filters={this.props.search.query.filters}/>;
    }
  },
  renderPopover: function () {
    if (this.state.isFocused
        && this.state.shouldShowTooltipIfWeGainFocus
        && !(this.shouldShowFilters() || this.state.suggestionsVisible)) {
    // if(1) {
      return (
          <SearchHelpPopover />
      );
    }
  }
});

module.exports = Search;
