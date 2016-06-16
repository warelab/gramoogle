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
      tooltipVisible: false,
      genomesDropdownVisible: false
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
  componentWillReceiveProps: function(newProps) {
    this.setState({
      tooltipVisible: this.shouldTooltipBeVisible(newProps)
    });
  },
  handleQueryChange: function (e) {
    var queryString = e.target.value;

    QueryActions.setQueryString(queryString);

    // For now, show typeahead if query string is not empty
    this.setState({
      suggestionsVisible: !!queryString.length,
      tooltipVisible: false
    });
  },
  searchBoxFocused: function () {
    return document.activeElement
        && document.activeElement.id === 'search-box'
  },
  shouldTooltipBeVisible: function(props = this.props, state = this.state) {
    const decision = this.searchBoxFocused()
        && state.tooltipVisible
        && !(
            this.shouldShowFilters(props)
            || state.suggestionsVisible
            || state.genomesDropdownVisible
        );
    console.log("Show popover?", this.state, this.shouldShowFilters(), decision)
    return decision;
  },
  toggleTooltipVisibilityIfAppropriate: function(state = this.state) {
    // we will toggle, unless we would be
    // toggling to on state
    // and suggestions are visible.
    return !state.tooltipVisible
        && !state.suggestionsVisible;
  },
  handleFocus: function () {
    this.setState({
      tooltipVisible: this.shouldTooltipBeVisible()
    })
  },
  handleClick: function () {
    this.setState({
      tooltipVisible: this.toggleTooltipVisibilityIfAppropriate()
    });
  },
  handleBlur: function () {
    this.setState({
      tooltipVisible: false
    });
  },
  clearInputString: function () {
    this.refs.searchBox.clearSearchString();
    this.setState({
      suggestionsVisible: false
    });
  },
  toggleGenomesDropdownVisibility: function (newState) {
    console.log("Toggle genome visibility", newState);

    this.setState({
      genomesDropdownVisible: newState,
      tooltipVisible: false
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
                     onQueryChange={this.handleQueryChange}
                     toggleGenomesOfInterest={this.toggleGenomesDropdownVisibility}
                     showGenomesOfInterest={this.state.genomesDropdownVisible}>

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
  shouldShowFilters: function (props = this.props) {
    return _.size(props.search.query.filters);
  },
  renderFilters: function () {
    if (this.shouldShowFilters()) {
      return <Filters filters={this.props.search.query.filters}/>;
    }
  },
  renderPopover: function () {
    if (this.state.tooltipVisible) {
      // if(1) {
      return (
          <SearchHelpPopover />
      );
    }
  }
});

module.exports = Search;
