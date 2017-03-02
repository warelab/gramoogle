import React from "react";

export default class Atlas extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const url = `./atlasWidget.html?geneQuery=${this.props.gene._id}&species=${this.props.gene.system_name.replace(/_/,'%20')}`;
    const height = (!!this.props.closeModal) ? window.innerHeight : '500px';
    return (
      <iframe src={url} frameBorder="0" width="100%" height={height}>
        <p>browser doesn't support iframes</p>
      </iframe>
    );
  }
}

Atlas.propTypes = {
  gene: React.PropTypes.object.isRequired
};