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
            <td className="xref-name-col">{displayName}</td>
            <td className="xref-value-col"><ol className="xref-id-list">{vals}</ol></td>
          </tr>
        );
      })
      .value();
  },

  render: function() {
    return (
      <bs.Table className="xrefs" condensed hover>
        <thead>
          <th className="xref-name-col">Database</th>
          <th className="xref-value-col">IDs and links</th>
        </thead>
        <tbody>
          {this.xrefs}
        </tbody>
      </bs.Table>
    );
  }
});