'use strict';

import React from 'react';
import _ from 'lodash';
import Search from './search/search.jsx';
import QueryActions from '../actions/queryActions';
import { browserHistory } from 'react-router';
import { Navbar, SplitButton, MenuItem } from 'react-bootstrap';

const Header = React.createClass({
  removeAllFilters: function() {
    QueryActions.removeAllFilters();
    browserHistory.push('/');
  },
  render: function() {

    var logo = (
      <a className="logo-link" onClick={this.removeAllFilters}><div className="logo"></div></a>
    );

    setTimeout(updateBodyTopPadding, 20);

    return (
      <Navbar id="search-header" className="header" fixedTop={false}>
        <Navbar.Header>
          <Navbar.Brand>
            {logo}
          </Navbar.Brand>
        </Navbar.Header>
        <Search />
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