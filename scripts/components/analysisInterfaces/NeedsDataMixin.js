'use strict';

var React = require('react');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../../actions/queryActions');
var _ = require('lodash');

module.exports = {
  of: function() {
    var fields = Array.prototype.slice.call(arguments),
        keys = fields.map(function(field) {
          return field + '_for_analysis';
        }),
        rts = fields.map(function(field) {
          return resultTypes.get(
            'distribution',
            {
              'facet.field': field,
              key: field + '_for_analysis'
            }
          );
        }),
        rtByKey = _.zipObject(keys, rts);

    return {
      propTypes: {
        search: React.PropTypes.object.isRequired //,
        //filters: React.PropTypes.object.isRequired
      },
      getNeededData: function(key) {
        return this.props.search.results[key + '_for_analysis'];
      },
      componentWillMount: function () {
        _.forOwn(rtByKey, function(rt, key) {
          QueryActions.setResultType(key, rt);
        });
      },
      componentWillUnmount: function () {
        _.forOwn(rtByKey, function(rt, key) {
          QueryActions.removeResultType(key);
        });
      }
    };
  }
};
