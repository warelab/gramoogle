'use strict';

var React = require('react');
var Search = require('./search.jsx');
var Filters = require('./filters.jsx');

var bs = require('react-bootstrap');
var Navbar = bs.Navbar,
  NavItem = bs.NavItem,
  Nav = bs.Nav,
  MenuItem = bs.MenuItem,
  Button = bs.Button,
  Input = bs.Input,
  Panel = bs.Panel;

var Header = React.createClass({
  propTypes: {
    search: React.PropTypes.object
  },
  getInitialState: function() {
    return {
      filtersVisible: false
    };
  },
  toggleFiltersVisibility: function() {
    var newState = {
      filtersVisible: !this.state.filtersVisible
    };
    this.setState(newState);
  },
  render: function() {
    var search = this.props.search;

    var logo = (
      <a className="logo-link"><div className="logo"></div></a>
    );

    var filters;
    if(this.state.filtersVisible) {
      filters = <Filters />
    }

    return (
      <Navbar className="header" brand={logo}>
        <Search search={search} onFilterButtonPress={this.toggleFiltersVisibility}/>
        {filters}
      </Navbar>
    );
  }
});

module.exports = Header;