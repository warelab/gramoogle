import React from "react";
import ReactGA from "react-ga";

export default class Links extends React.Component {
  renderLinks() {
    return this.props.links.map((link, idx) =>
      <li key={idx}>
        <ReactGA.OutboundLink
          eventLabel={link.name}
          to={link.url}
          className="external-link">
          {link.name}
        </ReactGA.OutboundLink>
      </li>
    )
  }

  render() {
    return (
      <div className="links">
        <h5>Links to other resources</h5>
        <ul>
          {this.renderLinks()}
        </ul>
      </div>
    );
  }
}

Links.propTypes = {
  links: React.PropTypes.array.isRequired
};