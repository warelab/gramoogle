'use strict';

var React = require('react');
var Reflux = require('reflux');
var QueryActions = require('../../actions/queryActions');
var _ = require('lodash');

var Summary = require('./summary.jsx');
var Suggest = require('../suggest/suggest.jsx');

var bs = require('react-bootstrap');
var Button = bs.Button,
  Input = bs.Input;

var SearchBox = React.createClass({
  propTypes: {
    results: React.PropTypes.object.isRequired,
    onQueryChange: React.PropTypes.func.isRequired,
    onStatsButtonPress: React.PropTypes.func.isRequired
  },
  getInputNode: function() {
    return this.refs.textInput.getInputDOMNode();
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
    var resultsCountStatement;

    resultsCountStatement = (
      <Summary results={this.props.results} />
    );

    return (
      <Input type="search"
             id="search-box"
             ref="textInput"
             tabIndex="1"
             placeholder="Search for genes…"
             autoComplete="off"
             standalone={true}
             addonAfter={resultsCountStatement}
             onChange={this.props.onQueryChange}
      />
    );
  }
});

module.exports = SearchBox;