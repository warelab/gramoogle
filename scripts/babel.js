// import the styles (using lessify)
// require('../styles/main.less');
// 'use strict';

require('babel-register')({
  presets: ['es2015', 'react'],
  ignore: function(filename) {
    var result = filename.indexOf('gramoogle/scripts') == -1
      && filename.indexOf('gramene-genetree-vis/src') == -1
      && filename.indexOf('gramene-search-vis/kb') == -1
      // && filename.indexOf('babel-helper-builder-react-jsx') == -1;
    console.log(result, filename);
    return result;
  }
  // ignore: function(filename) {
  //   var result;
  //   // if(filename.match(/gramene\-\w+\-vis/)) {
  //   //   result = filename.match(/\.less$/);
  //   // }
  //   // else {
  //     result = filename.indexOf('gramoogle/scripts') > -1
  //       || filename.indexOf('gramene-') > -1;
  //   // }
  //
  //   console.log(result, filename);
  //
  //   return result;
  // }
});

global.window = {};
global.navigator = {userAgent: 'node'};

var React = require('react');
var ReactDOMServer = require('react-dom/server');

var App = React.createFactory(require('./components/app.jsx'));

module.exports = ReactDOMServer.renderToString(new App());