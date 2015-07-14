var React = require('react');
var _ = require('lodash');
var bs = require('react-bootstrap');
var dbxrefs = require('gramene-dbxrefs');

module.exports = React.createClass({

  componentWillMount: function() {
    this.xrefs = _(this.props.gene)
      .pick(function(val, name) {
        return dbxrefs.isKnown(name);
      })
      .map(function(val, name) {
        var xref = dbxrefs.fetch(name);
        var displayName = xref.label,
          vals = val.map(function(item) {
            var url = xref.url(item);
            return (
              <li><a href={url}>{item}</a></li>
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