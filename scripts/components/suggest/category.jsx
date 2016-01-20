'use strict';

var React = require('react');

var Term = require('./term.jsx');

var Category = React.createClass({
  propTypes: {
    hideLabel: React.PropTypes.bool,
    category: React.PropTypes.object.isRequired,
    idx: React.PropTypes.number.isRequired
  },
  render: function () {
    var category, categorySuggestions, listClassName, result, label, catIdx;
    category = this.props.category;
    catIdx = this.props.idx;
    if(!this.props.hideLabel) {
      label = <h3>{category.label}</h3>
    }
    categorySuggestions = category.suggestions.map(function (suggestedTerm, termIdx) {
      var idx = ((catIdx + 1) * 100) + termIdx;
      return (
        <Term idx={idx} key={suggestedTerm.id} suggestedTerm={suggestedTerm}/>
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