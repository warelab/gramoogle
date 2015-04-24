'use strict';

var React = require('react');
var TextSearch = require('./textSearch.jsx');

var bs = require('react-bootstrap');
var Navbar = bs.Navbar,
  NavItem = bs.NavItem,
  Nav = bs.Nav,
  MenuItem = bs.MenuItem,
  Button = bs.Button,
  Input = bs.Input,
  Panel = bs.Panel;

var Header = React.createClass({
  propTypes: {
    search: React.PropTypes.object
  },
  render: function() {
    var search = this.props.search;

    var logo = (
      <a className="logo-link"><div className="logo"></div></a>
    );

    var resultsCountStatement = (
      <span className="tiny">
        <div className="resultsCount"><strong>1634634</strong> genes</div>
        <div><strong>38</strong> genomes</div>
      </span>
    );

    var filterDropdown = (
      <Button>Filter <span className="caret"></span></Button>
    );

    return (
      <Navbar className="header" brand={logo}>
        <TextSearch search={search} />
        <Panel className="filters">
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
        </Panel>
      </Navbar>
    );
  }
});

module.exports = Header;