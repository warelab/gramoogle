'use strict';

var React = require('react');
var suggestStore = require('../../stores/suggestStore');
var queryActions = require('../../actions/queryActions');
var _ = require('lodash');

var bs = require('react-bootstrap');

var Term = React.createClass({
  propTypes: {
    suggestedTerm: React.PropTypes.object.isRequired
  },
  getInitialState: function() {
    return { hidden: false };
  },
  acceptSuggestion: function () {
    var suggestedTerm = _.clone(this.props.suggestedTerm);

    console.log('user wants', suggestedTerm);

    if (suggestedTerm.num_genes == 0) {
      console.log('not adding filter for ' + suggestedTerm.display_name + ' because it will have no results');
      return;
      // TODO maybe tell the user?
    }

    suggestedTerm.exclude = false; // so we can toggle between include/exclude

    if(!suggestedTerm.fq) {
      suggestedTerm.fq = suggestedTerm.fq_field + ':' + suggestedTerm.fq_value;
    }

    // Notify the rest of the app
    queryActions.setFilter(suggestedTerm);
    queryActions.removeQueryString();

    // Immediately hide the node. We are not currently storing
    // state inside suggestStore because suggestions are ephemeral
    this.setState({hidden: true});
  },
  render: function () {
    var suggestion = this.props.suggestedTerm;
    var className = 'term' +
      (suggestion.num_genes == 0 ? ' empty' : '') +
      (this.state.hidden ? ' hidden' : '');
    return (
      <li className={className}>
        <a onClick={this.acceptSuggestion}>
          {suggestion.display_name}
          <bs.Badge bsStyle="warning">{suggestion.num_genes}</bs.Badge>
        </a>
      </li>
    );
  }
});

module.exports = Term;