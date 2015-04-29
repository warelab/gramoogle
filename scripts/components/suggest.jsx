'use strict';

var React = require('react');
var Reflux = require('reflux');
var suggestStore = require('../stores/suggestStore');

var bs = require('react-bootstrap');

var Suggest = React.createClass({
  mixins: [
    Reflux.connect(suggestStore, 'suggestions')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.suggest
  render: function() {
    var suggestions = this.state.suggestions;

    if(!suggestions) {
      return (
        <bs.Panel className="typeahead">
          <p>Loading…</p>
        </bs.Panel>
      );
    }

    var suggestLayout = suggestions.map(function(category) {

      var categorySuggestions = category.suggestions.map(function(suggestion) {
        return (
          <li className="suggestion" dangerouslySetInnerHTML={{__html:suggestion.term}}/>
        );
      });

      return (
        <li className="category">
          <h3>{category.label}</h3>
          <ul className="suggestions">
            {categorySuggestions}
          </ul>
        </li>
      );
    });

    return (
      <bs.Panel className="typeahead">
        <ul className="categories">
          {suggestLayout}
        </ul>
      </bs.Panel>
    );
  }
});

module.exports = Suggest;
