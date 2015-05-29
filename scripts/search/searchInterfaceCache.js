'use strict';

var _ = require('lodash');

module.exports = {
  GrameneCache: require('gramene-client-cache').init(100),

  getCountKey: function getCountKey(query) {
    return {
      q: query.q,
      filters: query.filters
    };
  },

  getRtKey: function getRtKey(countKey, rt) {
    return _.assign({resultType: rt}, countKey);
  },
  // find portions of the result set for a query that is already cached
  // and modify the query to prevent those items from being requested
  // from SOLR.
  findCachedResults: function findCachedResults(query) {

    // get cached result count
    var countKey = this.getCountKey(query);
    var count = this.GrameneCache.get(countKey);
    if (count !== undefined) {
      query.count = count;
    }

    // find result types with a cached result
    query.cachedResultTypes = _.omit(query.resultTypes, function (rt) {
      var key = this.getRtKey(countKey, rt);
      var cachedData = this.GrameneCache.get(key);
      if (cachedData) {
        rt.cachedResult = cachedData;
      }
      return !cachedData;
    }.bind(this));

    // remove them from the ones we will ask for from SOLR
    query.resultTypes = _.omit(
      query.resultTypes,
      _.keys(query.cachedResultTypes)
    );

    console.log('cached results found', _.keys(query.cachedResultTypes));
    return query;
  },

  // Incorporate cached results into results object.
  getResultsFromCache: function getResultsFromCache(results) {
    _.forOwn(results.metadata.searchQuery.cachedResultTypes, function (rt, name) {
      results[name] = rt.cachedResult;
    });

    return results;
  },

  // Add results from SOLR to the cache
  addResultsToCache: function addResultsToCache(query) {
    return function (results) {
      // add count
      var countKey = {q: query.q, filters: query.filters};
      this.GrameneCache.set(countKey, results.metadata.count);

      // add result types
      _.forOwn(query.resultTypes, function (rt, rtName) {
        var key = _.assign({resultType: rt}, countKey);
        this.GrameneCache.set(key, results[rtName]);
      }.bind(this));

      return results;
    }.bind(this);
  }
};