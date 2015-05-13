'use strict';

var React = require('react');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../../actions/queryActions');

module.exports = {
  for: function(field) {
    return {
      propTypes: {
        search: React.PropTypes.object.isRequired
      },
      getResultType: function() {
        return resultTypes.get(
          'facet',
          {
            'facet.field': field,
            'mincount': 1
          }
        );
      },
      componentWillMount: function () {
        QueryActions.setResultType(field, this.getResultType());
      },
      componentWillUnmount: function () {
        QueryActions.removeResultType(field);
      }
    };
  }
};
