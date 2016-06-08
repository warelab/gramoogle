'use strict';

var React = require('react');
var _ = require('lodash');

var Search = require('./search/search.jsx');
var QueryActions = require('../actions/queryActions');

var bs = require('react-bootstrap');
var Navbar = bs.Navbar;

var Header = React.createClass({
  propTypes: {
    search: React.PropTypes.object
  },
  removeAllFilters: function() {
    QueryActions.removeAllFilters();
  },
  render: function() {
    var search = this.props.search;

    var logo = (
      <a className="logo-link" onClick={this.removeAllFilters}><div className="logo"></div></a>
    );

    setTimeout(updateBodyTopPadding, 20);

    return (
      <Navbar id="search-header" className="header" fixedTop={true}>
        <Navbar.Header>
          <Navbar.Brand>{logo}</Navbar.Brand>
        </Navbar.Header>
        <Search search={search} />
      </Navbar>
    );
  }
});

(function listenForWindowResize() {
  var willUpdate = false;
  if(!willUpdate && global && _.isFunction(global.addEventListener)) {
    global.addEventListener('resize', function windowResizeListener(){
      willUpdate = true;
      setTimeout(function() {
        updateBodyTopPadding();
        willUpdate = false;
      }, 50);
    }, true);
  }
})();

var prevNavHeight = 50;
function updateBodyTopPadding() {
  var nav, body, navHeight;
  if(global.document && _.isFunction(document.querySelector)) {
    nav = document.querySelector('#search-header');
    if(!nav) {
      return;
    }
    navHeight = nav.offsetHeight - 1;
    body = document.querySelector('body');

    if(_.isNumber(navHeight) && navHeight > 0 && navHeight != prevNavHeight) {
      body.style['padding-top'] = navHeight + 'px';
      prevNavHeight = navHeight;
    }
  }
}

module.exports = Header;