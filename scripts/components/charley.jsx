'use strict';

var React = require('react');

var Charley = React.createClass({
  handleDelete: function() {
    this.props.onDelete(this.props.index);
  },
  render: function(){
    return (
      <figure>
        <img src="images/charlie.jpg" alt="Charlie Says…" />
        <figcaption>Charley Says "{this.props.what}"</figcaption>
        <button onClick={this.handleDelete}>Delete</button>
      </figure>
    );
  }
});
module.exports = Charley;