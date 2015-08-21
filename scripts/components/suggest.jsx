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
  getInitialState: function() {
    return { hidden: false };
  },
  acceptSuggestion: function () {
    var suggestedTerm = this.props.suggestedTerm;

    console.log('user wants', suggestedTerm);

    if (suggestedTerm.weight == 0) {
      console.log('not adding filter for ' + suggestedTerm.term + ' because it will have no results');
      return;
      // TODO maybe tell the user?
    }

    // remove highlighting now.
    suggestedTerm.term = suggestedTerm.term.replace(/<\/?em>/g, '');

    // shorten the term
    suggestedTerm.term = suggestedTerm.term.replace(/.*\|\s/, '');

    suggestedTerm.exclude = false; // so we can toggle between include/exclude

    // Notify the rest of the app
    queryActions.setFilter(this.props.suggestedTerm);
    queryActions.removeQueryString();

    // Immediately hide the node. We are not currently storing
    // state inside suggestStore because suggestions are ephemeral
    this.setState({hidden: true});
  },
  render: function () {
    var suggestion = this.props.suggestedTerm;
    var className = 'term' +
      (suggestion.weight == 0 ? ' empty' : '') +
      (this.state.hidden ? ' hidden' : '');
    return (
      <li className={className}>
        <a onClick={this.acceptSuggestion} dangerouslySetInnerHTML={{__html:suggestion.term}}/>
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
      var key = suggestedTerm.category + '-' + suggestedTerm.term;
      return (
        <Term key={key} suggestedTerm={suggestedTerm}/>
      );
    });
    listClassName = 'terms ' + category.className;

    return (
      <li className="category">
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
