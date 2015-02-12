'use strict';

var React = require('react');
var CharleyList = require('./charleyList.jsx');
var NewCharleyForm = require('./newCharleyForm.jsx');

var App = React.createClass({
  getInitialState: function () {
    return {
      charleySayings: [
        'always tell your mummy before you go off somewhere'
      ]
    };
  },

  addNewCharley: function(saying) {
    this.modifyCharleyList(function(newSayings) {
      newSayings.push(saying);
    });
  },

  deleteCharley: function(index) {
    this.modifyCharleyList(function(newSayings) {
      newSayings.splice(index, 1);
    });
  },

  modifyCharleyList: function(cb) {
    var newSayings = this.state.charleySayings;
    cb(newSayings); // mutate existing array
    this.setState({charleySayings: newSayings});
  },

  render: function () {
    return (
      <div>
        <NewCharleyForm onNewCharley={this.addNewCharley} />
        <CharleyList sayings={this.state.charleySayings} onDelete={this.deleteCharley}/>
      </div>
    );
  }
});

module.exports = App;