'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var FilterPickers = require('./filterPickers.jsx');

var Filters = React.createClass({
  render: function(){
    return (
      <bs.Panel className="filters">
        <bs.Row>
          <bs.Col xs={12} md={4}>
            <bs.ListGroup className="filterChooser">
              <bs.ListGroupItem active>Species<bs.Badge>38</bs.Badge></bs.ListGroupItem>
              <bs.ListGroupItem>Domain<bs.Badge>65376</bs.Badge></bs.ListGroupItem>
              <bs.ListGroupItem>GO<bs.Badge>6750</bs.Badge></bs.ListGroupItem>
              <bs.ListGroupItem>Expression</bs.ListGroupItem>
            </bs.ListGroup>
          </bs.Col>
          <bs.Col xs={12} md={8}>
            <h1>Do some filtering here!</h1>
            <p>This is where the filter UI would go</p>
          </bs.Col>
        </bs.Row>
      </bs.Panel>
    );
  }
});
module.exports = Filters;