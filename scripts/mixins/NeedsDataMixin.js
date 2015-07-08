'use strict';

/* @flow */
type Map = { [keys:string]: any };

var React = require('react');
var resultTypes = require('gramene-search-client').resultTypes;
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');

module.exports = {
  of: function(): Map {
    var fields = Array.prototype.slice.call(arguments),
        keys = fields.map(function(field: string): string {
          return field + '_for_analysis';
        }),
        rts = fields.map(function(field: string): { [keys: string]: string } {
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
        search: React.PropTypes.object.isRequired
      },
      getNeededData: function(key: number, newProps) {
        var props = newProps || this.props;
        return props.search.results[key + '_for_analysis'];
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
