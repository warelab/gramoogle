'use strict';

var React = require('react');

var ExpandedResult = React.createClass({
  propTypes: {
    geneDoc: React.PropTypes.object,
    docs: React.PropTypes.object, // all documents requested by the page.
    details: React.PropTypes.array.isRequired
  },

  render: function() {
    var geneDoc, docs, details;

    geneDoc = this.props.geneDoc;
    docs = this.props.docs;

    if(geneDoc) {
      details = this.props.details.map(function (detail) {
        var component = React.createElement(detail.reactClass, {gene: geneDoc, docs: docs, expanded: true}),
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