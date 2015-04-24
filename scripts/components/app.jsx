'use strict';

var React = require('react');
var Reflux = require('reflux');
var TextSearch = require('./textSearch.jsx');
var Filters = require('./filters.jsx');
var SearchSummary = require('./searchSummary.jsx');
var Results = require('./results.jsx');
var searchStore = require('../stores/searchStore');

var bs = require('react-bootstrap');
var Navbar = bs.Navbar,
    NavItem = bs.NavItem,
    Nav = bs.Nav,
    MenuItem = bs.MenuItem,
    Button = bs.Button,
    Input = bs.Input,
    Panel = bs.Panel;

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
          <Input className="foo"
                 type="search"
                 placeholder="Search for genes…"
                 standalone={true}
                 addonAfter={resultsCountStatement}
                 buttonAfter={filterDropdown} />
        </Nav>
        <div class="clearfix"></div>
        <Panel className="filters">
          <bs.Row>
            <bs.Col xs={12} md={4}>
              <bs.ListGroup className="filterChooser">
                <bs.ListGroupItem active>Species<bs.Badge>38</bs.Badge></bs.ListGroupItem>
                <bs.ListGroupItem>Domain<bs.Badge>65376</bs.Badge></bs.ListGroupItem>
                <bs.ListGroupItem>GO<bs.Badge>6750</bs.Badge></bs.ListGroupItem>
                <bs.ListGroupItem>Expression</bs.ListGroupItem>
              </bs.ListGroup>
            </bs.Col>
            <bs.Col xs={12} md={8}>
              <h1>Do some filtering here!</h1>
              <p>This is where the filter UI would go</p>
            </bs.Col>
          </bs.Row>
        </Panel>
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