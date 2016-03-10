'use strict';

var React = require('react');
var axios = require('axios');

var urlTemplate = 'http://plantreactomedev.oicr.on.ca/ReactomeRESTfulAPI/RESTfulWS/highlightPathwayDiagram/%pathwayId%/PNG';

var ReactomeImg = React.createClass({
  propTypes: {
    pathwayId: React.PropTypes.number.isRequired
  },
  componentWillMount: function() {
    var url = urlTemplate.replace('%pathwayId%', '' + this.props.pathwayId);
    axios.post(url, {data: ''}).then(function(response) {
      this.setState({dataURI: 'data:image/png;base64,' + response.data });
    }.bind(this));

  },
  getInitialState: function() {
    return {};
  },
  renderImg: function() {
    var dataURI = this.state.dataURI;
    if(dataURI) {
      return (
        <img src={this.state.dataURI} />
      )
    }
  },
  render: function() {
    return (
      <div className="reactomeImage">
        {this.renderImg()}
      </div>
    );
  }
});

module.exports = ReactomeImg;