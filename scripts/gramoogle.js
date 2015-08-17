'use strict';

// import the styles (using lessify)
require('../styles/main.less');

var React = require('react');
var App = React.createFactory(require('./components/app.jsx'));

React.render(new App(), document.getElementById('content'));