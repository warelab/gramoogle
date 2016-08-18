'use strict';

import React from "react";
import _ from "lodash";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
import docStore from "../../stores/docStore";
import Result from "./../result/result.jsx";


export default class ResultsList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  getResultType() {
    return resultTypes.get(
        'list',
        {rows: 10}
    );
  }

  componentWillMount() {
    QueryActions.setResultType('list', this.getResultType());

    this.unsubDocs = docStore.listen(
        (docs) => this.setState({docs})
    );
  }

  componentWillUnmount() {
    QueryActions.removeResultType('list');

    if (this.unsubDocs) {
      this.unsubDocs();
    }
  }

  moreResults() {
    QueryActions.moreResults(20);
  }

  render() {
    const docs = this.state.docs;
    const geneDocs = _.get(docs, 'genes') || {};
    const list = this.props.results.list;

    if (list && list.length) {
      var searchResults = list.map(function (searchResult) {
        return (
            <Result key={searchResult.id}
                    searchResult={searchResult}
                    geneDoc={geneDocs[searchResult.id]}
                    docs={docs}/>
        );
      });

      return (
          <div className="results-list-container">
            <ol className="results-list">
                {searchResults}
            </ol>
               {this.moreButton()}
          </div>
      );
    }
    else {
      return (
          <p>No results.</p>
      );
    }
  }

  moreButton() {
    const list = this.props.results.list;
    const totalResults = this.props.results.metadata.count;
    if (list.length < totalResults) {
      return (
          <ul className="more-results">
            <li>
              <a onClick={this.moreResults}>More genes</a>
            </li>
          </ul>
      );
    }
  }
}

ResultsList.propTypes = {
  results: React.PropTypes.object.isRequired,
};