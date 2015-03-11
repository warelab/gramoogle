'use strict';

var cores = require('./solrCores');
var $ = require('jquery');
var Q = require('q');
var _ = require('lodash');

function geneSearch(queryString, filters) {
  var coreName = 'genes';
  var url = cores.getUrlForCore(coreName);
  var params = cores.getSearchParams(coreName, queryString || '*', filters);

  return Q($.getJSON(url, params))
      .then(reformatFacetData)
      .then(incorporateLinksIntoResults)
      .then(incorporateHighlightsIntoResults)
      .then(addFunctions)
      .catch(function(error) {
        console.log(error);
      });
}

function reformatFacetData(results) {
  var originalFacets = results.facet_counts.facet_fields;
  if(originalFacets && !results.facets) {
    var fixed = results.facets = {};
    for(var f in originalFacets) {
      if(originalFacets[f].length > 1) {
        fixed[f] = reformatFacet(originalFacets[f], cores.getXrefDisplayName(f));
      }
    }
    delete results.facet_counts;
  }
  return results;
}

function incorporateHighlightsIntoResults(data) {
  var results = data.response.docs
    , highlights = data.highlighting;

  for(var i = 0; i < results.length; i++) {
    var result = results[i]
      , highlight = highlights[result.id];

    for(var field in highlight) {
      result[field] = highlight[field][0];
    }
  }
  return data;
}

function incorporateLinksIntoResults(data) {
  var ensemblUrl = 'http://ensembl.gramene.org/SYSTEM_NAME/Gene/Summary?db=DATABASE;g=GENEID';
  var genetreeUrl = 'http://ensembl.gramene.org/Multi/GeneTree/Image?gt=GENETREE';
  var results = data.response.docs;

  for(var i = 0; i < results.length; i++) {
    var result = results[i];
    result.geneUrl = ensemblUrl.replace('SYSTEM_NAME', result.system_name)
      .replace('DATABASE', result.database)
      .replace('GENEID', result.id);

    if(result.eg_gene_tree) {
      result.egGenetreeUrl = genetreeUrl.replace('GENETREE', result.eg_gene_tree);
    }

    if(result.epl_gene_tree) {
      result.eplGenetreeUrl = genetreeUrl.replace('GENETREE', result.epl_gene_tree);
    }
  }

  return data;
}

function reformatFacet(facetData, displayName) {
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
    result.ids.push(id);
    result.data[id] = { count: count };
    if(count > 0) result.count++;
  }
  return result;
}

function addFunctions(data) {
  data.getSpecies = getSpeciesFunction(data);
  data.getFilters = getFiltersFunction(data);
  return data;
}

function getSpeciesFunction(results) {
  return function(callback) {
    if(results && results.facets && results.facets.taxon_id) {
      var promise = facetSearch('taxonomy', results.facets.taxon_id);
      promise.then(callback);
    }
  }
}

function getFiltersFunction(results) {
  return function (callback) {
    if (results && results.facets) {
      var promises = Object.keys(results.facets).map(function (f) {
        var facet = results.facets[f]
          , core = cores.getXrefCore(f);
        return facetSearch(core, facet);
      });
      Q.all(promises).done(function () {
        callback(results.facets);
      })
    }
  }
}

function facetSearch(core, facet) {
  var url = cores.getUrlForCore(core)
    , params = cores.getFacetDetailsParams(core);

  if(facet.ids.length === 0) {
    return Q(facet);
  }

  params.q = 'id:('+facet.ids.join(' ')+')';
  params.rows = facet.ids.length;

  return Q($.getJSON(url, params)).then(function(data) {
    return mergeFacetData(facet, data);
  });
}

function mergeFacetData(facet, data) {
  var facetData = data.response.docs;
  for(var i = 0; i < facetData.length; i++) {
    var facetDatum = facetData[i]
      , toUpdate = facet.data['' + facetDatum.id];

    for(var key in facetDatum) {
      toUpdate[key] = facetDatum[key];
    }
  }
  toUpdate.hasAdditionalData = true;
  return facet;
}

//function addFilter(field, id, callback) {
//  filtered[field] = id;
//  geneSearch(query, callback); // query is stateful; module-scoped.
//};
//function hasFilters() {
//  return Object.keys(filters).length;
//};
//function getFilter(field, callback) {
//  return Object.keys(filters[field]);
//  geneSearch(query, callback); // query is stateful; module-scoped.
//};
//function clearFilter(filter, callback) {
//  delete filters[filter];
//  geneSearch(query, callback); // query is stateful; module-scoped.
//}
//function clearFilters(callback) {
//  filters = {};
//  geneSearch(query, callback); // query is stateful; module-scoped.
//};
//


exports.geneSearch = geneSearch;
//exports.addFilter = addFilter;
//exports.getFilters = getFilters;
//exports.clearFilter = clearFilter;
////exports.clearFilters = clearFilters;
//exports.getSpecies = getSpecies;
//exports.getFilters = getFilters;
