'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../actions/queryActions');
var Result = require('./result/result.jsx');


var ResultsList = React.createClass({
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
    var list, markup, more;

    list = this.props.results.list;
    if(list && list.length) {
      var results = list.map(function(result) {
        return (
          <Result key={result.id} gene={result} />
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
            {results}
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