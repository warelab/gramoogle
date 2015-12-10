'use strict';

var React = require('react');
var _ = require('lodash');
var lutStore = require('../stores/lutStore');

module.exports = {
  lutFor: function() {
    var luts = Array.prototype.slice.call(arguments)

    return {
      getLutState: function() {
        return {luts: _.pick(lutStore.state, luts)};
      },
      updateTaxonLut: function() {
        this.setState(this.getLutState());
      },
      componentDidMount: function() {
        // only add listener if all lookup tables haven't been built yet
        if(this.state.luts && !_.every(luts, (lut) => this.state.luts[lut] )) {
          this.unsub = lutStore.listen(this.updateTaxonLut);
        }
      },
      compenentWillUnmount: function() {
        if(this.unsub) {
          this.unsub();
        }
      }
    };
  }
};
