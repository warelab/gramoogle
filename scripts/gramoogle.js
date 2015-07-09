'use strict';

// dalliance uses node for build but exposes its modules as globals on the window object.
// for now we will require it here to load the libs and just reference the global objects
// directly where necessary (at the moment, in components/browser.jsx)
require('../node_modules/dalliance/js/exports');

var React = require('react');
var App = React.createFactory(require('./components/app.jsx'));

React.render(new App(), document.getElementById('content'));