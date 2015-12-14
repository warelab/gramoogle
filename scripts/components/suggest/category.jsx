'use strict';

var React = require('react');

var Term = require('./term.jsx');

var Category = React.createClass({
  propTypes: {
    hideLabel: React.PropTypes.bool,
    category: React.PropTypes.object.isRequired
  },
  render: function () {
    var category, categorySuggestions, listClassName, result, label;
    category = this.props.category;
    if(!this.props.hideLabel) {
      label = <h3>{category.label}</h3>
    }
    categorySuggestions = category.suggestions.map(function (suggestedTerm) {
      return (
        <Term key={suggestedTerm.id} suggestedTerm={suggestedTerm}/>
      );
    });
    listClassName = 'terms ' + category.className;

    return (
      <li key={category.label} className="category">
        {label}
        <ul className={listClassName}>
          {categorySuggestions}
        </ul>
      </li>
    );
  }
});

module.exports = Category;