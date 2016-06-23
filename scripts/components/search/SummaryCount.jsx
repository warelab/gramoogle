import React from "react";
import _ from "lodash";
import Spinner from '../Spinner.jsx';

export default class SummaryCount extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      newData: false
    }
  }

  componentWillReceiveProps(newProps) {
    if(this.value(newProps) !== this.value()) {
      this.setState({newData: true});
      setTimeout(()=>this.setState({newData: false}), 500);
    }
  }

  value(props = this.props) {
    return _.get(props.results, this.props.path);
  }

  haveValue() {
    return !_.isUndefined(this.value());
  }

  className() {
    return this.state.newData ? "updated-value" : "";
  }

  render() {
    return this.haveValue()
        ? <strong className={this.className()}>{this.value()}</strong>
        : <Spinner/>;

  }
}

SummaryCount.propTypes = {
  results: React.PropTypes.object.isRequired,
  path: React.PropTypes.string
};