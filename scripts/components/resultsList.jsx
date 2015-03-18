'use strict';

var React = require('react');
var resultTypes = require('../config/resultTypes');
var SearchActions = require('../actions/searchActions');

var ResultsList = React.createClass({
  componentWillMount: function() {
    SearchActions.setResultType('list', resultTypes.get('list'));
  },
  componentWillUnmount: function() {
    SearchActions.removeResultType('list');
  },
  render: function(){
    return (
      <ol className="resultsList">
        <li>Results</li>
        <li>List</li>
      </ol>
    );
  }
});
module.exports = ResultsList;