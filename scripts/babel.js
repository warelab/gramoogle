// import the styles (using lessify)
// require('../styles/main.less');
// 'use strict';

require('babel-register')({
  presets: ['es2015', 'react'],
  ignore: function(filename) {
    var result;
    if(filename.match(/gramene\-\w+\-vis/)) {
      result = filename.match(/\.less$/);
    }
    else {
      result = filename.indexOf('gramoogle/scripts') == -1;
    }

    console.log(result, filename);
    return result;
  }
});

global.window = {};
global.navigator = {userAgent: 'node'};

console.log(navigator);

var React = require('react');
var ReactDOMServer = require('react-dom/server');

var App = React.createFactory(require('./components/app.jsx'));

module.exports = ReactDOMServer.renderToString(new App());