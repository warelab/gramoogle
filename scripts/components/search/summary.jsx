'use strict';

var React = require('react');
var QueryActions = require('../../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;
var _ = require('lodash');

import SummaryCount from "./SummaryCount.jsx";
import Spinner from "../Spinner.jsx";
import searchStore from "../../stores/searchStore";

var resultType = resultTypes.get('facet');

export default class Summary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    }
  componentWillMount() {
    QueryActions.setResultType('taxon_id', resultType);
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
      this.setState({search: searchState})
    );
  }
  componentWillUnmount() {
    QueryActions.removeResultType('taxon_id');
    this.unsubscribeFromSearchStore();
  }
  render() {
    let results = this.state.search ? this.state.search.results : undefined;

    // this only happens when the page is statically rendered during compile.
    if (!results) {
      return (
          <div className="results-summary">
            <span className="gene-count"><Spinner /> genes</span>
            <span className="join"> in </span>
            <span className="genomes-count"><Spinner /> genomes</span>
          </div>
      )
    }

    return (
        <div className="results-summary">
          <span className="gene-count"><SummaryCount results={results} path="metadata.count"/> genes</span>
          <span className="join"> in </span>
          <span className="genomes-count"><SummaryCount results={results} path="taxon_id.count"/> genomes</span>
        </div>
    );
  }
}
