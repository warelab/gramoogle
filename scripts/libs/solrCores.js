'use strict';
var _ = require('lodash');

var rootURL = 'http://data.gramene.org/44/search/';
var cores = {
  genes: {
    enabled: true,
    labelField: 'gene_id',
    params: {
      rows: 10,
      wt: 'json',
      //fl : 'id,database,system_name,gene_id,genetrees,name_s',
      hl: 'true',
      'hl.fl': '*',
      fq: [],
      facet: 'true',
      'facet.mincount': 0,
      'facet.field': ['taxon_id', 'interpro_xrefi', 'GO_xrefi', 'PO_xrefi']
    },
    xref: {
      taxon_id: {core: 'taxonomy', displayName: 'Species'},
      interpro_xrefi: {core: 'interpro', displayName: 'Domain'},
      GO_xrefi: {core: 'GO', displayName: 'GO'},
      PO_xrefi: {core: 'PO', displayName: 'PO'}
    },
  },
  taxonomy: {
    enabled: true,
    params: {
      rows: 10,
      wt: 'json',
      fl: 'id,name_s,rank_s',
      hl: 'true',
      'hl.fl': '*',
      fq: []
    },
    params2: {
      wt: 'json',
      fl: 'id,name_s,rank_s',
      rows: 10
    },
  },
  interpro: {
    enabled: true,
    params: {
      rows: 10,
      wt: 'json',
      fl: 'id,name_s,type_s',
      hl: 'true',
      'hl.fl': '*',
      fq: []
    },
    params2: {
      wt: 'json',
      fl: 'id,name_s,type_s',
      rows: 10
    }
  },
  GO: {
    enabled: true,
    params: {
      rows: 10,
      wt: 'json',
      fl: 'id,name_s',
      hl: 'true',
      'hl.fl': '*',
      fq: ['!is_obsolete_s:1']
    },
    params2: {
      wt: 'json',
      fl: 'id,name_s',
      rows: 10
    }
  },
  PO: {
    enabled: true,
    params: {
      rows: 10,
      wt: 'json',
      fl: 'id,name_s',
      hl: 'true',
      'hl.fl': '*',
      fq: ['!is_obsolete_s:1']
    },
    params2: {
      wt: 'json',
      fl: 'id,name_s',
      rows: 10
    }
  }
};

function copyObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}

exports.getUrlForCore = function (core) {
  return rootURL + core + '?';
};

exports.getSearchParams = function (coreName, queryString, filters) {
  var core = cores[coreName]
    , params = copyObject(core.params);

  if (queryString) { params.q = queryString + '*' }

  if (filters) {
    for (var prop in filters) {
      var xref;
      if (core.xref && (xref = core.xref[prop])) {
        var ids = filters[prop];
        if (ids.length > 0) {
          if (xref.core === 'taxonomy') {
            params.fq.push('NCBITaxon_ancestors:(' + ids.join(' ') + ')');
          }
          else {
            params.fq.push(prop + ':(' + ids.join(' AND ') + ')');
          }
        }
      }
    }
  }
  return params;
};

exports.getFacetDetailsParams = function (core) {
  var params = cores[core].params2;
  return copyObject(params);
};

exports.hasXrefs = function (core) {
  return cores[core].hasOwnProperty('xref');
};

exports.getXrefCore = function (xref) {
  return cores.genes.xref[xref].core;
};

exports.getXrefDisplayName = function (xrefName) {
  var xref = cores.genes.xref[xrefName];
  return xref ? xref.displayName : xrefName;
};

exports.valuesAreNumeric = function (fieldName) {
  return fieldName && (
    _.startsWith(fieldName, 'bin')
    || _.endsWith(fieldName, 'i')
    || _.endsWith(fieldName, '_bin')
    || _.endsWith(fieldName, '_id')
  );
};
