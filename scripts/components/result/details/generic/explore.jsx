import React from 'react';

export default class Explore extends React.Component {
  render() {
    return (
      <div className="explore">
        <h5>Explore Gramene</h5>
        <ul>
          {this.props.children}
        </ul>
      </div>
    );
  }
}