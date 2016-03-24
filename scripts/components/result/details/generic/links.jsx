import React from 'react';

export default class Links extends React.Component{
  render() {
    return (
      <div className="links">
        <h5>Links to other resources</h5>
        <ul>
          {this.props.children}
        </ul>
      </div>
    );
  }
}