'use strict';

var React = require('react');
var Reflux = require('reflux');
var charleyStore = require('../stores/charleyStore');
var CharleyList = require('./charleyList.jsx');
var NewCharleyForm = require('./newCharleyForm.jsx');

var CharleyApp = React.createClass({
  mixins: [Reflux.connect(charleyStore, 'charleySayings')], // this mixin binds the store to this.state.charleySayings
  render: function () {
    return (
      <div>
        <NewCharleyForm />
        <CharleyList sayings={this.state.charleySayings} />
      </div>
    );
  }
});

module.exports = CharleyApp;