'use strict';

var React = require('react');
var Reflux = require('reflux');
var Header = require('./header.jsx');
var Results = require('./results/results.jsx');
var Welcome = require('./welcome.jsx');
var searchStore = require('../stores/searchStore');
var _ = require('lodash');

var App = React.createClass({

  mixins: [
    Reflux.connect(searchStore, 'search')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.search

  dontShowResults: function () {
    // don't show the results if there are no user-specified filters 
    return _.isEmpty(_.get(this.state.search, 'query.filters'));
  },
  
  render: function () {
    var search = this.state.search,
      content = this.dontShowResults() ?
        <Welcome/> :
        <Results results={search.results}/>
      ;

    return (
      <div className="app">
        <div className="container">
          <Header search={search}/>
          {content}
        </div>
      </div>
    );
  }
});

module.exports = App;