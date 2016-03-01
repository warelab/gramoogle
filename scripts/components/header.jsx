'use strict';

var React = require('react');
var _ = require('lodash');

var Search = require('./search/search.jsx');
var Analysis = require('./analysis.jsx');
var QueryActions = require('../actions/queryActions');

var bs = require('react-bootstrap');
var Navbar = bs.Navbar;

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

    setTimeout(updateBodyTopPadding, 20);

    return (
      <Navbar id="search-header" className="header" fixedTop={true}>
        <Navbar.Header>
          <Navbar.Brand>{logo}</Navbar.Brand>
        </Navbar.Header>
        <Search search={search} onAnalysisButtonPress={this.toggleAnalysisVisibility}/>
        {analysis}
      </Navbar>
    );
  }
});

(function listenForWindowResize() {
  var willUpdate = false;
  if(!willUpdate && window && _.isFunction(window.addEventListener)) {
    window.addEventListener('resize', function windowResizeListener(){
      willUpdate = true;
      setTimeout(function() {
        updateBodyTopPadding();
        willUpdate = false;
      }, 50);
    }, true);
  }
})();

var prevNavHeight = 51;
function updateBodyTopPadding() {
  var nav, body, navHeight;
  if(document && _.isFunction(document.querySelector)) {
    nav = document.querySelector('#search-header');
    if(!nav) {
      return;
    }
    navHeight = nav.offsetHeight;
    body = document.querySelector('body');

    if(_.isNumber(navHeight) && navHeight > 0 && navHeight != prevNavHeight) {
      body.style['padding-top'] = navHeight + 'px';
      prevNavHeight = navHeight;
    }
  }
}

module.exports = Header;