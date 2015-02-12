'use strict';

var React = require('react');

var NewCharleyForm = React.createClass({
  handleNewCharley: function (e) {
    var whatCharleySays = this.refs.newCharleySays.getDOMNode();
    e.preventDefault();
    this.props.onNewCharley(whatCharleySays.value.trim());
    whatCharleySays.value = '';
  },
  render: function() {
    return (
      <form ref="newCharleyForm" onSubmit={this.handleNewCharley}>
        <label for="newCharleySays">What should Charley say?</label>
        <input type="text" ref="newCharleySays" placeholder="React" />
        <button>New Charley</button>
      </form>
    );
  }
});

module.exports = NewCharleyForm;