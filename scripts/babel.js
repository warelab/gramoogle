// import the styles (using lessify)
// require('../styles/main.less');
'use strict';

var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));

var context = argv.c;

require('babel-register')({
  presets: ['es2015', 'react']
});

global.window = {};
global.navigator = {userAgent: 'node'};

var React = require('react');
var ReactDOMServer = require('react-dom/server');

var App = React.createFactory(require('./components/appStatic.jsx').default);

fs.writeFileSync(`static/${context}.html.fragment`, ReactDOMServer.renderToString(new App({context: context})));