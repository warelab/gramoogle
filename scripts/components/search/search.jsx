'use strict';

import React from "react";
import _ from "lodash";
import {Nav} from "react-bootstrap";
import SearchBox from "./searchBox.jsx";
import SearchHelpPopover from "../welcome/SearchHelpPopover.jsx";
import QueryActions from "../../actions/queryActions";
import Suggest from "../suggest/suggest.jsx";
import Filters from "./filters.jsx";


export default class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionsVisible: false,
      tooltipVisible: false,
      genomesDropdownVisible: false
    };

    // bind event handlers to `this`
    _.bindAll(this, [
      'handleFocus',
      'handleBlur',
      'handleClick',
      'handleQueryChange',
      'toggleGenomesDropdownVisibility',
      'clearInputString'
    ]);
  }

  componentDidMount() {
    // listen directly to an action method.

    // Why?

    // If we bind the search input's value to the query string state
    // then it is updated when the search response comes back

    // then it's really hard to use. So it's disconnected from the rest
    // of app state and we must manually clear it here if the query string is
    // removed (e.g. when a suggestion is picked)
    QueryActions.removeQueryString.listen(this.clearInputString);
  }

  componentWillReceiveProps(newProps) {
    this.setState({
      tooltipVisible: this.shouldTooltipBeVisible(newProps)
    });
  }

  handleQueryChange(e) {
    var queryString = e.target.value;

    QueryActions.setQueryString(queryString);

    // For now, show typeahead if query string is not empty
    this.setState({
      suggestionsVisible: !!queryString.length,
      tooltipVisible: false
    });
  }

  searchBoxFocused() {
    return document.activeElement
        && document.activeElement.id === 'search-box'
  }

  shouldTooltipBeVisible(props = this.props, state = this.state) {
    const decision = this.searchBoxFocused()
        && state.tooltipVisible
        && !(
            this.shouldShowFilters(props)
            || state.suggestionsVisible
            || state.genomesDropdownVisible
        );
    console.log("Show popover?", this.state, this.shouldShowFilters(), decision)
    return decision;
  }

  toggleTooltipVisibilityIfAppropriate(state = this.state) {
    // we will toggle, unless we would be
    // toggling to on state
    // and suggestions are visible.
    return !state.tooltipVisible
        && !state.suggestionsVisible;
  }

  handleFocus() {
    this.setState({
      tooltipVisible: this.shouldTooltipBeVisible()
    })
  }

  handleClick() {
    this.setState({
      tooltipVisible: this.toggleTooltipVisibilityIfAppropriate()
    });
  }

  handleBlur() {
    this.setState({
      tooltipVisible: false
    });
  }

  clearInputString() {
    this.refs.searchBox.clearSearchString();
    this.setState({
      suggestionsVisible: false
    });
  }

  toggleGenomesDropdownVisibility(newState) {
    console.log("Toggle genome visibility", newState);

    this.setState({
      genomesDropdownVisible: newState,
      tooltipVisible: false
    });
  }

  render() {
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
  }

  renderSuggestions() {
    if (this.state.suggestionsVisible) {
      return <Suggest queryString={this.props.search.query.q}/>;
    }
  }

  shouldShowFilters(props = this.props) {
    return _.size(props.search.query.filters);
  }

  renderFilters() {
    if (this.shouldShowFilters()) {
      return <Filters filters={this.props.search.query.filters}/>;
    }
  }

  renderPopover() {
    if (this.state.tooltipVisible) {
      // if(1) {
      return (
          <SearchHelpPopover />
      );
    }
  }
};

Search.propTypes = {
  search: React.PropTypes.object.isRequired,
};
