import React from "react";
import QueryTerm from "../../queryTerm.jsx";

export default class Explore extends React.Component {
  renderExplorations() {
    return this.props.explorations.map(
      (exploration, idx) =>
        <li key={idx}>
          <QueryTerm {...exploration} />
        </li>
    );
  }

  render() {
    return (
      <div className="explore">
        <h5>Search</h5>
        <ul>
          {this.renderExplorations()}
        </ul>
      </div>
    );
  }
}

Explore.propTypes = {
  explorations: React.PropTypes.array.isRequired
};