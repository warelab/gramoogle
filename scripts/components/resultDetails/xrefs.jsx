var React = require('react');
var _ = require('lodash');
var bs = require('react-bootstrap');

module.exports = React.createClass({

  componentWillMount: function() {
    this.xrefs = _(this.props.gene)
      .pick(function(val, name) {
        return name.indexOf('_xref') !== -1;
      })
      .map(function(val, name) {
        var displayName = name.substring(0, name.indexOf('_')),
          vals = val.map(function(item) {
          return (
            <li><a>{item}</a></li>
          );
        });
        return (
          <tr>
            <td>{displayName}</td>
            <td><ol>{vals}</ol></td>
          </tr>
        );
      })
      .value();
  },

  render: function() {
    return (
      <bs.Table condensed hover>
        <tbody>
          {this.xrefs}
        </tbody>
      </bs.Table>
    );
  }
});