'use strict';

var React = require('react');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../actions/queryActions');
var Result = require('./result.jsx');

var ResultsList = React.createClass({
  getInitialState: function () {
    return {rows: 10};
  },
  getResultType: function() {
    return resultTypes.get(
      'list',
      {rows: this.state.rows}
    );
  },
  componentWillMount: function () {
    QueryActions.setResultType('list', this.getResultType());
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType('list');
  },
  render: function () {
    var list = this.props.results.list;
    if(list) {
      var results = list.map(function(result) {
        return (
          <Result gene={result} />
        );
      });
      return (
        <ol className="resultsList">
        {results}
        </ol>
      );
    }

    return (
      <p>No results</p>
    )
  }
});
module.exports = ResultsList;