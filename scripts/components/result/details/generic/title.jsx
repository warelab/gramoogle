import React from 'react';

export default class Title extends React.Component {
  render() {
    return (
      <h4>{this.props.children}</h4>
    );
  }
};