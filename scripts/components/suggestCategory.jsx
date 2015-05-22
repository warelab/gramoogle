'use strict';

var React = require('react');
var Reflux = require('reflux');
var suggestStore = require('../stores/suggestStore');

var bs = require('react-bootstrap');

var SuggestCategory = React.createClass({
  render: function () {


    var categorySuggestions = category.suggestions.map(function (suggestion) {
      return (
        <li className="term" dangerouslySetInnerHTML={{__html:suggestion.term}}/>
      );
    });

    return (
      <li className="category">
        <h3>{category.label}</h3>
        <ul className="terms">
          {categorySuggestions}
        </ul>
      </li>
    );
  }
});