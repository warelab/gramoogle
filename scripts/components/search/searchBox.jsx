'use strict';

var React = require('react');
var _ = require('lodash');

var Summary = require('./summary.jsx');

import TaxonomyMenu from '../GoI/TaxonomyMenu.jsx';

import { InputGroup, FormControl, Dropdown, MenuItem } from 'react-bootstrap';

var SearchBox = React.createClass({
  propTypes: {
    results: React.PropTypes.object.isRequired,
    onQueryChange: React.PropTypes.func.isRequired,
  },
  getInputNode: function() {
    return document.getElementById('search-box');
  },
  clearSearchString: function() {
    this.getInputNode().value = '';
  },
  focus: function() {
    this.getInputNode().focus();
  },
  componentDidMount: function() {
    var val = this.getInputNode().value;
    if(val !== '') {
      this.props.onQueryChange({target: {value: val}});
    }
    this.focus();
  },
  render: function() {
    return (
        <InputGroup>
            <FormControl type="search"
                    id="search-box"
                    tabIndex="1"
                    placeholder="Search for genes…"
                    autoComplete="off"
                    standalone={true}
                    onChange={this.props.onQueryChange} />
            <TaxonomyMenu>
              <Summary results={this.props.results} />
            </TaxonomyMenu>
        </InputGroup>
    );
  }
});

module.exports = SearchBox;