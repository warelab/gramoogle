'use strict';

var React = require('react');

var ExpandedResult = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired,
    details: React.PropTypes.array.isRequired
  },

  render: function() {
    var gene, details;

    gene = this.props.gene;

    details = this.props.details.map(function(detail) {
      var component = React.createElement(detail.reactClass, {gene: gene, expanded: true}),
        key = gene.id + '-exp-' + detail.name;
      return (
        <div key={key} className="expanded-detail">
          <h4>{detail.name}</h4>
          {component}
        </div>
      );
    });

    return (
      <div className="expanded-details">
        {details}
      </div>
    );
  }
});

module.exports = ExpandedResult;