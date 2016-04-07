'use strict';

// import the styles (using lessify)
// require('../styles/main.less');

var React = require('react');
var ReactDOM = require('react-dom');

var App = React.createFactory(require('./components/app.jsx'));

ReactDOM.render(new App(), document.getElementById('content'));