'use strict';

var React = require('react');
var Reflux = require('reflux');
var TextSearch = require('./textSearch.jsx');
var Filters = require('./filters.jsx');
var Results = require('./results.jsx');
var searchStore = require('../stores/searchStore');

var App = React.createClass({
  mixins: [
    Reflux.connect(searchStore, 'search')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.search
  render: function () {
    var search = this.state.search;

    return (
      <div className="app">
        <header>Gramene Logo</header>
        <TextSearch query={search.query} />
        <Filters query={search.query} results={search.results} /> {/* use metadata to display result count, time, etc in summary view.*/}
        <Results results={search.results} />
      </div>
    );
  }
});

module.exports = App;