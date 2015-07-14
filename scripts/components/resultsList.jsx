'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../actions/queryActions');
var Result = require('./result.jsx');


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
    var list, markup;

    list = this.props.results.list;
    if(list && list.length) {
      var results = list.map(function(result) {
        return (
          <Result key={result.id} gene={result} />
        );
      });

      markup = (
        <div className="results-list-container">
          <ol className="results-list">
            {results}
          </ol>
          <ul className="more-results">
            <li>
              <a onClick={this.moreResults}>More genes</a>
            </li>
          </ul>
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