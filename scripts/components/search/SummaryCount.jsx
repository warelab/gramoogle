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
    const curVal = this.value();
    const newVal = this.value(newProps);
    if(!_.isUndefined(curVal) && curVal !== newVal) {
      this.setState({newData: true});
      setTimeout(()=>this.setState({newData: false}), 500);
    }
  }

  value(props = this.props) {
    let value = _.get(props.results, this.props.path);
    if (props.cutoff && props.cutoff === value) {
      value = `>${value-1}`
    }
    return value;
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