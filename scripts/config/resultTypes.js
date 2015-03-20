'use strict';

var _ = require('lodash');

var resultTypes = {
  list: {
    rows: 10,
    start: 0
  },
  distribution: {
    'facet.limit': -1,
    'facet.mincount': 1
  },
  facet: {
    'facet.limit': 50,
    'facet.mincount': 0,
    'facet.field': 'taxon_id'
  }
};

module.exports = {
  get: function (type, details) {
    var rt = _.cloneDeep(resultTypes[type]);
    var facetField;

    if(!rt) return;

    // details are specific configurations for this 'instance' of
    // the result type, e.g. facet field.
    if (details) {

      // add the details to the object
      _.assign(rt, details);
    }

    // special case: if 'facet.field' is defined then rename any
    // facet-specific config to apply only to that field, e.g.
    // if facet.field is 'bin_10Mb', then solr param 'facet.limit'
    // would be renamed 'f.bin_10Mb.facet.limit'. This allows different
    // facet limits for different result types.
    facetField = rt['facet.field'];
    if (facetField) {
      rt = _.transform(rt, function (result, val, key) {
        if (key !== 'facet.field' && key.indexOf('facet') === 0) {
          key = 'f.' + facetField + '.' + key;
        }
        result[key] = val;
      });
    }

    return rt;
  }
};