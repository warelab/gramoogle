'use strict';

var React = require('react');
var Reflux = require('reflux');
var suggestStore = require('../../stores/suggestStore');
var _ = require('lodash');

var bs = require('react-bootstrap');

var Category = require('./category.jsx');

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
            <Category idx="2" category={suggestionCategories[0]} hideLabel={true} />
          </ul>
        </bs.Panel>
      )
    }

    var suggestLayout = _(suggestionCategories)
      .filter(function (category) {
        return !!category.suggestions.length;
      })
      .map(function (category, idx) {
        return (
          <Category idx={idx} key={category.label} category={category}/>
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
