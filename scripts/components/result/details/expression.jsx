import React from "react";

export default class Atlas extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentDidMount() {
    if (this.widget) {
      expressionAtlasHeatmapHighcharts.render({
        params: "geneQuery=" + this.props.gene._id + "&species=" + this.props.gene.system_name.replace(/_/,'%20'),
        isMultiExperiment: true,
        target: this.widget
      });
    }
  }

  render() {
    return (
        <div className='expressionAtlas' ref={(elem) => this.widget = elem}></div>
    );
  }
}

Atlas.propTypes = {
  gene: React.PropTypes.object.isRequired
};