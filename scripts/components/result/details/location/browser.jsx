import React from "react";
import DallianceBrowser from "./dallianceBrowser.jsx";
import isEqual from "lodash/isEqual";
import {Col, Button} from "react-bootstrap";

export default class Browser extends React.Component {
  constructor(props) {
    super(props);
    this.initialVisibleRange = props.visibleRange;
  }

  resetVisibleRange() {
    var {chr, start, end} = this.initialVisibleRange;
    this.props.onViewChange(chr, start, end)
  }

  render() {
    return (
      <div className="location-browser">
        <Col xs={12} sm={9}>
          {this.renderBiodalliance()}
        </Col>
        <Col xs={12} sm={3}>
          {this.renderResetButton()}
        </Col>
      </div>
    )
  }

  renderBiodalliance() {
    return (
      <DallianceBrowser {...this.props} />
    );
  }

  renderResetButton() {
    // active={!isEqual(this.props.visibleRange, this.initialVisibleRange)}
    return (
      <Button
              onClick={this.resetVisibleRange.bind(this)}>
        Reset
      </Button>
    )
  }
}

Browser.propTypes = {
  gene: React.PropTypes.object.isRequired,
  expanded: React.PropTypes.bool,
  visibleRange: React.PropTypes.object.isRequired,
  onViewChange: React.PropTypes.func.isRequired
};