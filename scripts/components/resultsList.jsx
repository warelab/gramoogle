'use strict';

var React = require('react');
var Reflux = require('reflux');
var _ = require('lodash');
var bs = require('react-bootstrap');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../actions/queryActions');
var DocActions = require('../actions/docActions');
var docStore = require('../stores/docStore');

var Result = require('./result/result.jsx');


var ResultsList = React.createClass({
  mixins: [Reflux.connect(docStore,"docs")],
  getResultType: function() {
    return resultTypes.get(
      'list',
      {rows: 10}
    );
  },
  componentWillMount: function () {
    QueryActions.setResultType('list', this.getResultType());
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType('list');
  },
  moreResults: function() {
    QueryActions.moreResults(20);
  },
  render: function () {
    var list, markup, more, geneDocs, docs, singleResult;

    geneDocs = _.get(this.state, 'docs.genes') || {};
    docs = this.state.docs;
    list = this.props.results.list;
    singleResult = list && list.length === 1;
    if(singleResult) {
      DocActions.needDocs('genes', list[0].id);
    }
    if(list && list.length) {
      var searchResults = list.map(function(searchResult) {
        return (
          <Result key={searchResult.id}
                  searchResult={searchResult}
                  geneDoc={geneDocs[searchResult.id]}
                  expandedByDefault={singleResult}
                  docs={docs} />
        );
      });

      if (list.length < this.props.results.metadata.count) {
        more = (
          <ul className="more-results">
            <li>
              <a onClick={this.moreResults}>More genes</a>
            </li>
          </ul>
        );
      }

      markup = (
        <div className="results-list-container">
          <ol className="results-list">
            {searchResults}
          </ol>
          {more}
        </div>
      );
    }
    else {
      markup = (<p></p>);
    }

    return markup;
  }
});
module.exports = ResultsList;