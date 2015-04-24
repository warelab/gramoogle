'use strict';

var React = require('react');
var Reflux = require('reflux');
var Header = require('./header.jsx');
//var TextSearch = require('./textSearch.jsx');
//var Filters = require('./filters.jsx');
//var SearchSummary = require('./searchSummary.jsx');
var Results = require('./results.jsx');
var searchStore = require('../stores/searchStore');

var App = React.createClass({
  mixins: [
    Reflux.connect(searchStore, 'search')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.search
  render: function () {
    var search = this.state.search;

    return (
      <div className="app container">
        <Header search={search} />
        <Results results={search.results} />
      </div>
    );
    //
    //return (
    //  <div className="app">
    //      <div class="container-fluid">
    //        <div className="logo"> </div>
    //        <TextSearch query={search.query} metadata={search.metadata} />
    //        <SearchSummary filters={search.query.filters}
    //                       results={search.results} />
    //        <Filters query={search.query} results={search.results} />
    //    </nav>
    //    <Results results={search.results} />
    //  </div>
    //);
  }
});

module.exports = App;