'use strict';

var React = require('react');
var resultTypes = require('../config/resultTypes');
var QueryActions = require('../actions/queryActions');

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
    return (
      <ol className="resultsList">
        <li>Results</li>
        <li>List</li>
      </ol>
    );
  }
});
module.exports = ResultsList;