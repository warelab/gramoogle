'use strict';

var React = require('react');

var ExpandedResult = React.createClass({
  propTypes: {
    geneDoc: React.PropTypes.object,
    details: React.PropTypes.array.isRequired
  },

  render: function() {
    var geneDoc, details;

    geneDoc = this.props.geneDoc;

    if(geneDoc) {
      details = this.props.details.map(function (detail) {
        var component = React.createElement(detail.reactClass, {gene: geneDoc, expanded: true}),
          key = geneDoc._id + '-exp-' + detail.name;
        return (
          <div key={key} className="expanded-detail">
            <h4>{detail.name}</h4>
            {component}
          </div>
        );
      });
    }
    else {
      details = <p>Loading…</p>;
    }
    return (
      <div className="expanded-details">
        {details}
      </div>
    );


  }
});

module.exports = ExpandedResult;