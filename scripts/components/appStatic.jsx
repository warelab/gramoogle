'use strict';

/*
This file is the main component (instead of app.jsx) when we create static content
 during build by babel.js to improve search engine indexing and perceived page load
 time. babel.js is run in a separate process in `exec:generateStaticApp`, and the generated
 output file is incorporated into index.html during `packageIndexHtml`.

It has been modified so as to not require the majority of the app to be instantiated. 
(Diff it with app.jsx to see what happened.)

Currently it hits the network, but not until after the markup has been written to disk. 
It can be run with no network connectivity and the file is still generated.

(That does not mean that this isn't a bit of a hack.)
 */

var React = require('react');
var Header = require('./header.jsx');
var Welcome = require('./welcome.jsx');
var _ = require('lodash');

var App = React.createClass({

  render: function () {
    return (
      <div className="app">
        <div className="container">
          <Header search={ {query:{}, results:{} } } />
          <Welcome />
        </div>
      </div>
    );
  }
});

module.exports = App;