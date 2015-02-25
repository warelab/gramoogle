'use strict';

var React = require('react');
var Reflux = require('reflux');
var TextSearch = require('./textSearch.jsx');
var Filters = require('./filters.jsx');
var Results = require('./results.jsx');
var searchStore = require('../stores/searchStore');

var App = React.createClass({
  mixins: [Reflux.connect(searchStore, 'search')], // this mixin binds the store (where search/filter/results state lives) to this.state.search
  render: function () {
    return (
      <div>
        <header>Gramene Logo</header>
        <TextSearch />
        <Filters />
        <Results />
      </div>
    );
  }
});

module.exports = App;