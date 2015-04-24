'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');
var filters = require('../config/filters');
var bs = require('react-bootstrap');
var Nav = bs.Nav,
  Button = bs.Button,
  Input = bs.Input;

var TextSearch = React.createClass({
  propTypes: {
    search: React.PropTypes.object.isRequired
  },
  handleChange: function(e) {
    var node = this.refs.searchBox.getDOMNode();
    // required for testing.
    if(e.target.value != node.value) {
      node.value = e.target.value;
    }
    var queryString = node.value;
    QueryActions.setQueryString(queryString);
  },
  render: function(){
    var resultsCountStatement = (
      <small>
        <div className="resultsCount"><strong>1634634</strong> genes</div>
        <div><strong>38</strong> genomes</div>
      </small>
    );

    var filterDropdown = (
      <Button>Filter <span className="caret"></span></Button>
    );

    return (
      <Nav right={true} className="searchBoxNav">
        <Input className="foo"
               type="search"
               placeholder="Search for genes…"
               standalone={true}
               addonAfter={resultsCountStatement}
               buttonAfter={filterDropdown} />
      </Nav>
      //<div className="search">
      //  <input placeholder="Search for Genes" ref="searchBox" type="text" defaultValue={this.props.query.q} onChange={this.handleChange} />
      //</div>
    );
  }
});
module.exports = TextSearch;