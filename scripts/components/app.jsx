'use strict';

var React = require('react');
var Reflux = require('reflux');
var TextSearch = require('./textSearch.jsx');
var Filters = require('./filters.jsx');
var SearchSummary = require('./searchSummary.jsx');
var Results = require('./results.jsx');
var searchStore = require('../stores/searchStore');

var bootstrap = require('react-bootstrap');
var Navbar = bootstrap.Navbar,
    NavItem = bootstrap.NavItem,
    Nav = bootstrap.Nav,
    MenuItem = bootstrap.MenuItem,
    Button = bootstrap.Button,
    Input = bootstrap.Input;

var App = React.createClass({
  mixins: [
    Reflux.connect(searchStore, 'search')
  ], // this mixin binds the store (where search/filter/results state lives) to this.state.search
  render: function () {
    var search = this.state.search;

    var logo = (
      <a className="logo-link"><div className="logo"></div></a>
    );

    var resultsCountStatement = (
      <span className="tiny">
        <div className="resultsCount"><strong>1634634</strong> genes</div>
        <div><strong>38</strong> genomes</div>
      </span>
    );

    var filterDropdown = (
      <Button>Filter <span className="caret"></span></Button>
    );

    return (
      <Navbar className="header" brand={logo}>
        <Nav right={true} className="searchBoxNav">
          <Input className="foo" type="search" placeholder="Search for genes…" addonAfter={resultsCountStatement} buttonAfter={filterDropdown} />
        </Nav>
      </Navbar>
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