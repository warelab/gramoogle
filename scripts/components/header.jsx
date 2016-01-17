'use strict';

var React = require('react');
var Search = require('./search/search.jsx');
var Analysis = require('./analysis.jsx');
var QueryActions = require('../actions/queryActions');

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
      analysisVisible: false
    };
  },
  toggleAnalysisVisibility: function() {
    var newState = {
      analysisVisible: !this.state.analysisVisible
    };
    this.setState(newState);
  },
  removeAllFilters: function() {
    QueryActions.removeAllFilters();
  },
  render: function() {
    var search = this.props.search;

    var logo = (
      <a className="logo-link" onClick={this.removeAllFilters}><div className="logo"></div></a>
    );

    var analysis;
    if(this.state.analysisVisible) {
      analysis = <Analysis search={search}/>
    }

    return (
      <Navbar className="header" brand={logo} fixedTop={true} >
        <Search search={search} onAnalysisButtonPress={this.toggleAnalysisVisibility}/>
          {analysis}
      </Navbar>
    );
  }
});

module.exports = Header;