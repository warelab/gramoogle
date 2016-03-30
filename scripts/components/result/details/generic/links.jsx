import React from "react";

export default class Links extends React.Component {
  renderLinks() {
    return this.props.links.map((link) =>
      <li>
        <a className="external-link" href={link.url}>{link.name}</a>
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