'use strict';

var React = require('react');
var QueryActions = require('../actions/queryActions');
var resultTypes = require('../config/resultTypes');
var _ = require('lodash');
var rgbHex = require('rgb-hex');

var ResultsVisualization = React.createClass({
  getInitialState: function () {
    return {binWidth: 1000, binType: 'fixed'};
  },
  getFieldName: function () {
    return this.state.binType + '_' + this.state.binWidth + '_bin';
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
    if (bins) {
      var maxCount = _.max(bins.data, function (bin) {
        return bin.count;
      }).count;
      var maxBin = _.last(bins.ids);

      var boxes = _.range(maxBin).map(function (idx) {
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
  var minRgb = [255, 255, 255]; // white
  var maxRgb = [255, 0, 0]; // red

  if (!count) {
    return '#' + rgbHex.apply(this, minRgb);
  }

  if (!max) {
    return '#' + rgbHex.apply(this, maxRgb);
  }

  var ratio = Math.log(count) / Math.log(max);

  var rgb = _.range(3).map(function (idx) {
    return Math.floor(((maxRgb[idx] - minRgb[idx]) * ratio) + minRgb[idx]);
  });

  var hex = rgbHex.apply(this, rgb);

  return '#' + hex;
}

module.exports = ResultsVisualization;