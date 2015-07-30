'use strict';

var React = require('react');
var Reflux = require('reflux');
var Header = require('./header.jsx');
var Results = require('./results.jsx');
var Welcome = require('./welcome.jsx');
var searchStore = require('../stores/searchStore');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');

var App = React.createClass({

  mixins: [
    Reflux.connect(searchStore, 'search')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.search

  getInitialState: function () {
    return {
      showResults: false, // don't show results initially
    };
  },

  componentWillUpdate: function () {
    // show results if we have already done that or if there are filters.
    // (conversely, only show the welcome screen if the user has never
    // supplied a filter.)
    if(!this.state.showResults && !!_.size(this.state.search.query.filters)) {
      this.setState({showResults: true});
    }
  },

  render: function () {
    var search = this.state.search,
      content;

    content = this.state.showResults ?
      <Results results={search.results}/> :
      <Welcome/>
    ;

    return (
      <div className="app container">
        <Header search={search}/>
        {content}
      </div>
    );
  }
});

module.exports = App;