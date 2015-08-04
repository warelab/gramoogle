var React = require('react');
var _ = require('lodash');
var bs = require('react-bootstrap');
var dbxrefs = require('gramene-dbxrefs');

var HOW_MANY_TO_SHOW_BY_DEFAULT = 10;

var Xref = React.createClass({
  propTypes: {
    displayName: React.PropTypes.string.isRequired,
    members: React.PropTypes.array.isRequired
  },
  
  getInitialState: function() {
    return {showAll: false}
  },
  
  toggleShowAll: function() {
    this.setState({showAll: !this.state.showAll});
  },
  
  possiblyTruncateList: function(vals) {
    var ellipsis, ellipsisChar, ellipsisTitle;
    
    if(vals.length > HOW_MANY_TO_SHOW_BY_DEFAULT) {
      if(this.state.showAll) {
        ellipsisChar = '^ show first ' + HOW_MANY_TO_SHOW_BY_DEFAULT;
        ellipsisTitle = 'Show less';
      }
      else {
        ellipsisChar = '… show all (' + (vals.length - HOW_MANY_TO_SHOW_BY_DEFAULT) + ' more)';
        ellipsisTitle = 'Show more';
        vals = vals.slice(0, HOW_MANY_TO_SHOW_BY_DEFAULT);
      }
      
      ellipsis = (
        <li key="showMore" className="showAll"><a title={ellipsisTitle} onClick={this.toggleShowAll}>{ellipsisChar}</a></li>
      );
      
      vals.push(ellipsis);
    }
    
    return vals;
  },
  
  render: function() {
    var members, vals;
    
    members = this.props.members;
    
    vals = _(members)
      .map(function(m) {
        return m.val;
      })
      .flatten(true)
      .sort()
      .uniq(true) // TODO figure out why there are duplicates.
      .map(function(item, idx) {
        var url = members[0].url(item),
            liClass = idx < HOW_MANY_TO_SHOW_BY_DEFAULT ? "default" : "extra";
        return (
          <li key={idx} className={liClass}><a href={url}>{item}</a></li>
        )
      })
      .value();
      
    vals = this.possiblyTruncateList(vals);
    
    return (
      <tr>
        <td className="xref-name-col">{this.props.displayName}</td>
        <td className="xref-value-col"><ol className="xref-id-list">{vals}</ol></td>
      </tr>
    );
  }
});

var Xrefs = React.createClass({
  componentWillMount: function() {
    this.xrefs = _(this.props.gene)
    .pick(function(val, name) {
      return dbxrefs.isKnown(name);
    })
    .map(function(val, name) {
      var xref = dbxrefs.fetch(name);
      return {url: xref.url, label: xref.label, val: val};
    })
    .groupBy('label')
    .map(function(members, displayName) {
      return (
        <Xref key={displayName} displayName={displayName} members={members} />
      )
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

module.exports = Xrefs;