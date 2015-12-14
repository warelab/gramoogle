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
  clearSearchString: function() {
    this.refs.textInput.getInputDOMNode().value = '';
  },
  render: function() {
    var resultsCountStatement, statsDropdown;

    resultsCountStatement = (
      <Summary results={this.props.results} />
    );

    statsDropdown = (
      <Button onClick={this.props.onStatsButtonPress} disabled={true}>
        Analysis <span className="caret"></span>
      </Button>
    );
    return (
      <Input type="search"
             ref="textInput"
             placeholder="Search for genes…"
             standalone={true}
             addonAfter={resultsCountStatement}
             buttonAfter={statsDropdown}
             onChange={this.props.onQueryChange}
      />
    );
  }
});

module.exports = SearchBox;