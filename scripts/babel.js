// import the styles (using lessify)
// require('../styles/main.less');
'use strict';

var fs = require('fs');

require('babel-register')({
  presets: ['es2015', 'react']
});

global.window = {};
global.navigator = {userAgent: 'node'};

var React = require('react');
var ReactDOMServer = require('react-dom/server');

var App = React.createFactory(require('./components/appStatic.jsx'));

fs.writeFileSync('static/app.html.fragment', ReactDOMServer.renderToString(new App()));