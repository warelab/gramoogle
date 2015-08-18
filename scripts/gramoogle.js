'use strict';

// import the styles (using lessify)
require('../styles/main.less');

var React = require('react');
var App = React.createFactory(require('./components/app.jsx'));

React.render(new App(), document.getElementById('content'));

// Unhide the footer. (It's present in index.html and hidden to prevent FOUC.)
document.querySelector(".footer").removeAttribute("style");