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

    // Immediately hide the node. We are not currently storing
    // state inside suggestStore because suggestions are ephemeral
    this.setState({hidden: true});
  },
  render: function () {
    var suggestion = this.props.suggestedTerm;
    var className = 'term' +
      (suggestion.num_genes == 0 ? ' empty' : '') +
      (this.state.hidden ? ' hidden' : '');
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

var Suggest = React.createClass({
  mixins: [
    Reflux.connect(suggestStore, 'suggestions')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.suggest
  propTypes: {
    queryString: React.PropTypes.string.isRequired
  },
  render: function () {
    var suggestionCategories = this.state.suggestions;

    // if suggestionCategories is undefined, we haven't got our response back from the server yet.
    if (!suggestionCategories) {
      return (
        <bs.Panel className="suggestions">
          <p>Finding suggestions…</p>
        </bs.Panel>
      );
    }

    // if there is only one category, and it is flagged as "fullTextSearchOnly" (this is done in suggestStore#addQueryTerm)
    // then we should warn the user that no real suggestions have been found and that they are probably SOL.
    if(suggestionCategories.length === 1 && suggestionCategories[0].fullTextSearchOnly) {
      return (
        <bs.Panel className="suggestions">
          <bs.Alert bsStyle="warning">
            <strong>No suggestions found.</strong> You may still attempt a full text search, though it is unlikely to find any genes for you.
          </bs.Alert>
          <ul className="categories">
            <SuggestCategory category={suggestionCategories[0]} hideLabel={true} />
          </ul>
        </bs.Panel>
      )
    }

    var suggestLayout = _(suggestionCategories)
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
