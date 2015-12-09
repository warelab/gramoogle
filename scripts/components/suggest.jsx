'use strict';

var React = require('react');
var Reflux = require('reflux');
var suggestStore = require('../stores/suggestStore');
var queryActions = require('../actions/queryActions');
var _ = require('lodash');

var bs = require('react-bootstrap');

var Term = React.createClass({
  propTypes: {
    suggestedTerm: React.PropTypes.object.isRequired
  },
  acceptSuggestion: function () {
    var suggestedTerm = _.clone(this.props.suggestedTerm);

    console.log('user wants', suggestedTerm);

    if (suggestedTerm.num_genes == 0) {
      console.log('not adding filter for ' + suggestedTerm.display_name + ' because it will have no results');
      return;
      // TODO maybe tell the user?
    }

    suggestedTerm.exclude = false; // so we can toggle between include/exclude

    // TODO REMOVE THIS and rework searchStore.js and search.js to more gracefully handle this.
    suggestedTerm.fq = suggestedTerm.fq_field + ':' + suggestedTerm.fq_value;

    // Notify the rest of the app
    queryActions.setFilter(suggestedTerm);
    queryActions.removeQueryString();

    // immediately hide the node. This is very un-react-like
    // however we are not currently storing state inside
    // suggestStore so it is difficult to update the list
    // of suggestions. (This lack-of-state makes sense because
    // Suggestions are meant to be ephemeral.)
    React.findDOMNode(this).className += " hidden";
  },
  render: function () {
    var suggestion = this.props.suggestedTerm;
    var className = 'term' + (suggestion.num_genes == 0 ? ' empty' : '');
    return (
      <li className={className}>
        <a onClick={this.acceptSuggestion}>
          {suggestion.display_name}
          <bs.Badge bsStyle="warning">{suggestion.num_genes}</bs.Badge>
        </a>
      </li>
    );
  }
});

var SuggestCategory = React.createClass({
  propTypes: {
    category: React.PropTypes.object.isRequired
  },
  render: function () {
    var category, categorySuggestions, listClassName, result;
    category = this.props.category;
    categorySuggestions = category.suggestions.map(function (suggestedTerm) {
      return (
        <Term key={suggestedTerm.id} suggestedTerm={suggestedTerm}/>
      );
    });
    listClassName = 'terms ' + category.className;

    return (
      <li key={category.label} className="category">
        <h3>{category.label}</h3>
        <ul className={listClassName}>
          {categorySuggestions}
        </ul>
      </li>
    );
  }
});

var Suggest = React.createClass({
  mixins: [
    Reflux.connect(suggestStore, 'suggestions')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.suggest
  propTypes: {
    queryString: React.PropTypes.string.isRequired
  },
  render: function () {
    var suggestions = this.state.suggestions;

    if (!suggestions) {
      return (
        <bs.Panel className="suggestions">
          <p>Finding suggestions…</p>
        </bs.Panel>
      );
    }

    var suggestLayout = _(suggestions)
      .filter(function (category) {
        return !!category.suggestions.length;
      })
      .map(function (category) {
        return (
          <SuggestCategory key={category.label} category={category}/>
        );
      })
      .value();

    return (
      <bs.Panel className="suggestions">
        <ul className="categories">
          {suggestLayout}
        </ul>
      </bs.Panel>
    );
  }
});

module.exports = Suggest;
