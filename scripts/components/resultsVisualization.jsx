'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var resultTypes = require('../config/resultTypes');
var _ = require('lodash');
var rgbHex = require('rgb-hex');

var ResultsVisualization = React.createClass({
  getInitialState: function () {
    return {binWidth: '10Mb'};
  },
  getFieldName: function () {
    return 'bin_' + this.state.binWidth;
  },
  getDistributionParameters: function () {
    var fieldName = this.getFieldName();
    return resultTypes.get(
      'distribution',
      {'facet.field': fieldName}
    );
  },
  componentWillMount: function () {
    QueryActions.setResultType(
      this.getFieldName(),
      this.getDistributionParameters()
    );
  },
  componentWillUnmount: function () {
    QueryActions.removeResultType(this.getFieldName());
  },

  render: function () {
    var fieldName = this.getFieldName();
    var bins = this.props.results[fieldName];
    if(bins) {
      var maxCount = _.max(bins.data, function(bin) {
        return bin.count;
      }).count;

      var boxes = _.range(2335).map(function(idx) {
        var bin = bins.data[idx];
        var count = bin ? bins.data[idx].count : 0;
        var backgroundColorHex = calculateHexColor(count, maxCount);
        return (
          <span key={fieldName + idx} className="bin" style={{backgroundColor: backgroundColorHex}} title={count + ' in bin ' + idx}></span>
        );
      });

      return (
        <div className="bins">
          {boxes}
        </div>
      );
    }

    return (
      <figure className="vis">
        <img src="images/charlie.jpg" alt="Charlie Says…" />
        <figcaption>A Visualization</figcaption>
      </figure>
    );
  }
});

function calculateHexColor(count, max) {
  var minRgb = [255, 255, 255];
  var maxRgb = [255, 0, 0];

  if(!count) {
    return '#' + rgbHex.apply(this, minRgb);
  }

  var ratio = count / max;

  var rgb = [
    Math.floor(((maxRgb[0] - minRgb[0]) * ratio) + minRgb[0]),
    Math.floor(((maxRgb[1] - minRgb[1]) * ratio) + minRgb[1]),
    Math.floor(((maxRgb[2] - minRgb[2]) * ratio) + minRgb[2])
  ];

  var hex = rgbHex.apply(this, rgb);

  return '#' + hex;
}

module.exports = ResultsVisualization;