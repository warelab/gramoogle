'use strict';

var _ = require('lodash');

var filterTypes = {
  domain: {
    fq: 'Interpro_xrefi'
  },
  customFacet: {
    fq: 'biotype'
  }
};

module.exports = {
  get: function (type, details) {
    var ft = _.cloneDeep(filterTypes[type]);
    _.assign(ft, details);
    ft.type = type;
    return ft;
  }
};