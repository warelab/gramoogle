'use strict';

var Reflux = require('reflux');
var SearchActions = require('../actions/searchActions');

module.exports = Reflux.createStore({
  listenables: [SearchActions],
  onSetQueryString: function(newQueryString) {
    console.log("New query term is", newQueryString);
  }
});