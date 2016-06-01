'use strict';

var React = require('react');
var axios = require('axios');
var parseString = require('xml2js').parseString;

var urlTemplate = 'http://plantreactomedev.oicr.on.ca/ReactomeRESTfulAPI/RESTfulWS/highlightPathwayDiagram/%pathwayId%/';

var ReactomeImg = React.createClass({
  propTypes: {
    pathwayId: React.PropTypes.number.isRequired
  },
  componentWillMount: function () {
    var url = urlTemplate.replace('%pathwayId%', '' + this.props.pathwayId);
    axios.post(url + 'PNG', 'PP1S342_8V6.1', {headers: {'Content-Type': 'text/plain'}}).then(function (response) {
      console.log(response);
      this.setState({dataURI: 'data:image/png;base64,' + response.data});
    }.bind(this));

    axios.post(url + 'XML', 'PP1S342_8V6.1', {headers: {'Content-Type': 'application/xml'}}).then(function (response) {
      parseString(response.data, function (err, result) {
        this.setState({imageMetadata: result});
      }.bind(this));
    }.bind(this));

  },
  getInitialState: function () {
    return {};
  },
  renderImg: function () {
    var dataURI = this.state.dataURI;
    if (dataURI) {
      return (
        <img src={this.state.dataURI}/>
      )
    }
  },
  render: function () {
    return (
      <div className="reactomeImage">
        {this.renderImg()}
      </div>
    );
  }
});

module.exports = ReactomeImg;