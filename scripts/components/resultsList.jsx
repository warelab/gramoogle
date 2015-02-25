'use strict';

var React = require('react');
//var SearchActions = require('../actions/searchActions');

var ResultsList = React.createClass({
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