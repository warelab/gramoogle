import React from "react";
import _ from "lodash";

const HOW_MANY_TO_SHOW_BY_DEFAULT = 10;

export default class Xref extends React.Component {

  constructor(props) {
    super(props);
    this.state = {showAll: false};
  }

  toggleShowAll() {
    this.setState({showAll: !this.state.showAll});
  }

  possiblyTruncateList(vals) {
    var ellipsis, ellipsisChar, ellipsisTitle;

    if (vals.length > HOW_MANY_TO_SHOW_BY_DEFAULT) {
      if (this.state.showAll) {
        ellipsisChar = '^ show first ' + HOW_MANY_TO_SHOW_BY_DEFAULT;
        ellipsisTitle = 'Show less';
      }
      else {
        ellipsisChar = '… show all (' + (vals.length - HOW_MANY_TO_SHOW_BY_DEFAULT) + ' more)';
        ellipsisTitle = 'Show more';
        vals = vals.slice(0, HOW_MANY_TO_SHOW_BY_DEFAULT);
      }

      ellipsis = (
        <li key="showMore" className="showAll">
          <a title={ellipsisTitle} onClick={this.toggleShowAll}>{ellipsisChar}</a>
        </li>
      );

      vals.push(ellipsis);
    }

    return vals;
  }

  render() {
    var members, vals;

    members = this.props.members;

    vals = _(members)
      .map(function (m) {
        return m.val;
      })
      .flatten(true)
      .sort()
      .uniq(true) // TODO figure out why there are duplicates.
      .map(function (item, idx) {
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
        <td className="xref-value-col">
          <ol className="xref-id-list">{vals}</ol>
        </td>
      </tr>
    );
  }
}

Xref.propTypes = {
  displayName: React.PropTypes.string.isRequired,
  members: React.PropTypes.array.isRequired
};