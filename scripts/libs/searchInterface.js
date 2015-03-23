'use strict';

var cores = require('./solrCores');
var axios = require('axios');
var _ = require('lodash');

function geneSearch(query) {
  var coreName = 'genes';
  var url = cores.getUrlForCore(coreName);
  var params = getSolrParameters(query);
  //var params = cores.getSearchParams(coreName, queryString || '*', filters);

  return axios.get(url, {params: params})
    .then(reformatData);
}

function defaultSolrParameters() {
  return {
    q: '*',
    rows: 0,
    facet: true
  };
}

function getSolrParameters(query) {
  var result = defaultSolrParameters();

  result.q = (query.q || '') + '*';

  for(var rtName in query.resultTypes) {
    _.assign(result, query.resultTypes[rtName], function(existing, another) {
      var result = existing;

      // handle the case where the same key may be defined in many result types, for example
      // facet.field. It's typical for solr to have multiple facet.field parameters in the URL,
      // e.g. http://data.gramene.org/search/genes?wt=json&indent=true&q=*&rows=2&start=0&facet=true&facet.field=bin_10Mb&facet.field=bin_5Mb&facet.limit=10&facet.mincount=1&f.bin_10Mb.facet.limit=10&fq=Interpro_xrefs:(IPR008978 IPR002068)
      if(existing) {
        if(_.isArray(existing)) {
          existing.push(another);
          result = existing;
        }
        else {
          result = [existing, another];
        }
      }
      else {
        result = another;
      }

      return result;
    });
  }

  return result;
}

function reformatData(response) {
  var data = response.data;
  var originalFacets = data.facet_counts.facet_fields;
  if(originalFacets && !data.results) {
    var fixed = data.results = {};
    for(var f in originalFacets) {
      if(originalFacets[f].length > 1) {
        fixed[f] = reformatFacet(originalFacets[f], cores.valuesAreNumeric(f), cores.getXrefDisplayName(f));
      }
    }
    delete data.facet_counts;
  }
  if(data.response.docs.length) {
    fixed.list = data.response.docs;
  }
  fixed.metadata = {
    count: data.response.numFound,
    qtime: data.responseHeader.QTime
  };

  return fixed;
}

function reformatFacet(facetData, numericIds, displayName) {
  // facet data is an array of alternating ids (string) and counts (int),
  // e.g. ["4565", 99155, "3847", 54159, "109376", 46500, ... ]

  // we will make an object that contains an ordered list of ids
  // and an associative array with id key and an object for count and other values
  // e.g. { ids  : [ "4565", "3847", "109376" ],
  //        data : { "4565" : { count : 99155 }, // order here not guaranteed :-(
  //                 "3847" : { count: 54159 },
  //                 "109376" : { count: 46500 }
  //               }
  //      }
  var result = {ids: [], data: {}, count: 0, displayName: displayName};
  for (var i=0;i<facetData.length;i+=2) {
    var id = facetData[i]
      , count = facetData[i+1];

    if(numericIds) id = +id;
    result.ids.push(id);
    result.data[id] = { count: count };
    if(count > 0) result.count++;
  }
  return result;
}

exports.geneSearch = geneSearch;