var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');

import { Detail, Title, Description, Content, Explore, Links } from './generic/detail.jsx';

var Redesign = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    expanded: React.PropTypes.bool
  },

  render: function () {    
    return (
      <Detail>
        <Title>Gene location</Title>
        <Description>Foo bar baz</Description>
        <Content>
          <ul>
            <li>This</li>
            <li>Is</li>
            <li>Content</li>
          </ul>
        </Content>
        <Explore />
        <Links />
      </Detail>
    );
  }
});

module.exports = Redesign;