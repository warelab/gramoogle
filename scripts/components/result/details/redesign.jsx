var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');

import {Detail, Title, Description, Content, Explore, Links}
  from "./generic/detail.jsx";

export default class Redesign extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  handleSelection(selection) {
    this.setState({ selection: selection });
  }

  explorations() {
    return [
      {label: 'Search thingy', filter: {}},
      {label: 'Another search', filter: {}}
    ];
  }

  links() {
    return [
      {label: 'Ensembl', url: 'http://ensembl.gramene.org/'}
    ]
  }

  content() {
    return (
      <ul>
        <li>This</li>
        <li>Is</li>
        <li>Content</li>
      </ul>
    );
  }

  render() {
    return (
      <Detail>
        <Title>Gene location</Title>
        <Description>Foo bar baz</Description>
        <Content>
          {this.content()}
        </Content>
        <Explore explorations={this.explorations()} />
        <Links links={this.links()} />
      </Detail>
    );
  }
}

Redesign.propTypes = {
  gene: React.PropTypes.object.isRequired,
  expanded: React.PropTypes.bool
};