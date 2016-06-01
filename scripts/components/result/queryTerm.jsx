'use strict';

var React = require('react');
var Reflux = require('reflux');
var bs = require('react-bootstrap');
var _ = require('lodash');

var QueryTerm = React.createClass({
  propTypes: {
    category: React.PropTypes.string,
    name: React.PropTypes.string,
    count: React.PropTypes.number,
    handleClick: React.PropTypes.func.isRequired,
    questions: React.PropTypes.object
  },
  getInitialState: function () {
    return {alreadySelected: false, showModal: false};
  },
  handleClick: function () {
    if (this.props.questions) {
      this.showModalDialog();
    }
    else {
      this.applyFilter();
    }
  },
  applyFilter: function (choice) {
    this.props.handleClick(choice);
    this.setState({alreadySelected: true});
  },
  showModalDialog: function () {
    this.setState({showModal: true});
  },
  render: function () {
    var className, category, name, badge, modal;

    if (this.props.category) {
      category = this.props.category + ' | ';
    }
    name = this.props.name;
    className = "query-term";

    // if (this.state.alreadySelected) {
    //   className += " already-selected";
    // }

    if (this.state.showModal) {
      modal = '<p>This is a modal</p>';
    }

    if (_.isNumber(this.props.count)) {
      badge = <bs.Badge bsStyle="warning">{this.props.count}</bs.Badge>
    }

    return (
      <div className="query-term-outer">
        <div onClick={this.handleClick} className={className}>
          {category}
          <a onClick={this.handleClick}>{name}</a>
          {badge}
        </div>
        {modal}
      </div>
    );
  }
});

module.exports = QueryTerm;