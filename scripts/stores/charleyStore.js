'use strict';

var Reflux = require('reflux');
var CharleyActions = require('../actions/charleyActions');

module.exports = Reflux.createStore({
  listenables: [CharleyActions],
  onAddCharley: function (saying) {
    this.sayings.push(saying);
    this.trigger(this.sayings);
  },
  onDeleteCharley: function (index) {
    this.sayings.splice(index, 1);
    this.trigger(this.sayings);
  },
  getInitialState: function () {
    if (!this.sayings) {
      this.sayings = [
        'always tell your mummy before you go off somewhere (especially with reflux)'
      ];
    }
    return this.sayings;
  }
});