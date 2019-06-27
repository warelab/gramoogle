'use strict';

import React from "react";
import _ from "lodash";
import {Nav} from "react-bootstrap";
import SearchBox from "./searchBox.jsx";
import QueryActions from "../../actions/queryActions";
import Suggest from "../suggest/suggest.jsx";
import Filters from "./filters.jsx";
import searchStore from "../../stores/searchStore";

export default class Search extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      suggestionsVisible: false,
      helpVisible: false,
      genomesDropdownVisible: false
    };

    // bind event handlers to `this`
    _.bindAll(this, [
      'handleQueryChange',
      'toggleGenomesDropdownVisibility',
      'toggleHelpVisibility',
      'clearInputString'
    ]);
  }

  componentWillMount() {
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
      this.setState({search: searchState})
    );
  }

  componentWillUnmount() {
    this.unsubscribeFromSearchStore();
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
    QueryActions.setFilter.listen(this.clearInputString);
    QueryActions.setAllFilters.listen(this.clearInputString);
    QueryActions.removeFilter.listen(this.clearInputString);
    QueryActions.removeFilters.listen(this.clearInputString);
    QueryActions.removeAllFilters.listen(this.clearInputString);
    QueryActions.toggleFilter.listen(this.clearInputString);
  }

  handleQueryChange(queryString) {
    const suggestionsVisible = !!queryString.length;

    QueryActions.setQueryString(queryString);

    // For now, show typeahead if query string is not empty
    this.setState({
      suggestionsVisible: suggestionsVisible,
      helpVisible: this.state.helpVisible && !suggestionsVisible
    });
  }

  clearInputString() {
    this.refs.searchBox.clearSearchString();
    this.refs.searchBox.focus();
    window.scrollTo(0,0);
    this.setState({
      suggestionsVisible: false
    });
  }

  toggleGenomesDropdownVisibility(newState) {
    this.setState({
      genomesDropdownVisible: newState
    });
  }

  toggleHelpVisibility(newState) {
    this.setState({
      helpVisible: newState
    });

    this.refs.searchBox.focus();
  }

  render() {

    return (
        <Nav pullRight
             className="search-box-nav">
          <SearchBox ref="searchBox"
                     onQueryChange={this.handleQueryChange}
                     toggleGenomesOfInterest={this.toggleGenomesDropdownVisibility}
                     showGenomesOfInterest={this.state.genomesDropdownVisible}
                     toggleHelp={this.toggleHelpVisibility}
                     showHelp={this.state.helpVisible}>
          </SearchBox>

             {this.renderFilters()}
             {this.renderSuggestions()}
        </Nav>
    );
  }

  renderSuggestions() {
    if (this.state.suggestionsVisible && this.state.search) {
      return <Suggest queryString={this.state.search.query.q}/>;
    }
  }

  renderFilters() {
    if (this.state.search && this.state.search.query.filters) {
      return <Filters filters={this.state.search.query.filters}/>;
    }
  }
};
