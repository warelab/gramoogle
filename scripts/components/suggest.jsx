'use strict';

var React = require('react');
var Reflux = require('reflux');
var suggestStore = require('../stores/suggestStore');
var queryActions = require('../actions/queryActions');

var bs = require('react-bootstrap');

var Term = React.createClass({
  propTypes: {
    suggestedTerm: React.PropTypes.object.isRequired
  },
  acceptSuggestion: function() {
    var suggestedTerm = this.props.suggestedTerm;

    console.log('user wants', suggestedTerm);

    if(suggestedTerm.weight == 0) {
      console.log('not adding filter for ' + suggestedTerm.term + ' because it will have no results');
      return;
      // TODO maybe tell the user?
    }

    // remove highlighting now.
    suggestedTerm.term = suggestedTerm.term.replace(/<\/?em>/g, '');

    // shorten the term
    suggestedTerm.term = suggestedTerm.term.replace(/.*\|\s/,'');

    suggestedTerm.exclude = false; // so we can toggle between include/exclude

    // Notify the rest of the app
    queryActions.setFilter(this.props.suggestedTerm);
    queryActions.removeQueryString();

    // immediately hide the node. This is very un-react-like
    // however we are not currently storing state inside
    // suggestStore so it is difficult to update the list
    // of suggestions. (This lack-of-state makes sense because
    // Suggestions are meant to be ephemeral.)
    React.findDOMNode(this).className += " hidden";
  },
  render: function() {
    var suggestion = this.props.suggestedTerm;
    var className = 'term' + (suggestion.weight == 0 ? ' empty' : '');
    return (
      <li className={className}>
        <a onClick={this.acceptSuggestion} dangerouslySetInnerHTML={{__html:suggestion.term}} />
      </li>
    );
  }
});

var SuggestCategory = React.createClass({
  propTypes: {
    category: React.PropTypes.object.isRequired
  },
  render: function () {
    var category = this.props.category;
    var categorySuggestions = category.suggestions.map(function (suggestedTerm) {
      return (
        <Term suggestedTerm={suggestedTerm} />
      );
    });

    return (
      <li className="category">
        <h3>{category.label}</h3>
        <ul className="terms {category.className}">
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
  render: function() {
    var suggestions = this.state.suggestions;

    if(!suggestions) {
      return (
        <bs.Panel className="suggestions">
          <p>Finding suggestions…</p>
        </bs.Panel>
      );
    }

    var suggestLayout = suggestions.map(function(category) {
      return (
        <SuggestCategory key={category.label} category={category} />
      );
    });

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
