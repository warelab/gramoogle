import React from "react";
import ReactGA from "react-ga";
import {Glyphicon} from "react-bootstrap";

export default class Links extends React.Component {
  renderLinks() {
    let external = <small title="This link opens a page from an external site"> <Glyphicon glyph="new-window" /></small>;
    return this.props.links.map((link, idx) =>
      <li key={idx}>
        <ReactGA.OutboundLink
          eventLabel={link.name}
          to={link.url}
          className="external-link"
          target="_blank"
        >
          {link.name}{external}
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