'use strict';

var React = require('react');
var Reflux = require('reflux');
var Header = require('./header.jsx');
var Results = require('./results.jsx');
var Welcome = require('./welcome.jsx');
var searchStore = require('../stores/searchStore');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');

var Footer = React.createClass({
  render: function () {
    return (
      <div className="footer">
        <div className="container">
          <p>I am the footer</p>
        </div>
      </div>
    )
  }
});

var App = React.createClass({

  mixins: [
    Reflux.connect(searchStore, 'search')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.search

  render: function () {
    var search = this.state.search,
      showResults = !!_.size(this.state.search.query.filters),
      content = showResults ?
        <Results results={search.results}/> :
        <Welcome/>
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