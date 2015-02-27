'use strict';

var React = require('react');
var App = React.createFactory(require('./components/app.jsx'));

React.render(App(), document.getElementById('content'));