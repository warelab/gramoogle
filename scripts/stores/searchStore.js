'use strict';

/* @flow */

var Reflux = require('reflux');
var _ = require('lodash');
var QueryActions = require('../actions/queryActions');
import TaxonomyActions from '../actions/taxonomyActions';
import GoIActions from "../actions/genomesOfInterestActions";
import {initUrlHashPersistence, persistState} from "../search/persist";
import {trimFilters} from "../search/filterUtil";
var search = require('../search/search');

module.exports = Reflux.createStore({
  listenables: [QueryActions, GoIActions, TaxonomyActions],

  init: function () {
    this.state = {
      query: {
        q: '',
        filters: {}, // filterKey => object of solr parameters
        resultTypes: {} // key || fieldName => object of solr parameters
      },
      results: {
        list: [],
        metadata: {},
        tally: {}
      },
      global: {
        taxa: {} // key is taxon_id, value should be entry in taxonomy object
        // taxa: {3702:'ath',4577:'zm',39947:'o.sat', 15368: 'brachy', 3847: 'g.max'} // key is taxon_id, value should
        // be entry in taxonomy object
      }
    };

    // make a copy of the query to keep with the results
    this.state.results.metadata.searchQuery = _.cloneDeep(this.state.query);

    // hook up search from ../search/search.js.
    // search.js' debounce function would like a reference of this store's state so that
    // it can get an up-to-date query object, functions to use for success and failure
    // and a debounce time in ms.
    this.search = search.debounced(
        this.state, // state object so search can access current query state
        this.searchComplete, // called when done
        this.searchError, // called on error
        200 // debounce time in ms
    );

    // update query state from URL hash if it changes (e.g. back/fwd button press)
    initUrlHashPersistence(this.overwriteFilterState);
  },

  // This is a lookup table, so don't perform a search when it is called.
  getTaxonomyCompleted: function (payload) {
    _.assign(this, payload);
  },

  getInitialState: function () {
    return this.state;
  },

  overwriteFilterState: function (updatedPersistedState) {
    const {filters, taxa} = updatedPersistedState;
    this.state.query.filters = filters || {};
    this.state.global.taxa = taxa || {};
    this.search();
  },

  setResultType: function (rtKey, params) {
    console.log('setResultType', arguments);
    this.state.query.resultTypes[rtKey] = params;
    this.search();
  },

  removeResultType: function (rtKey) {
    console.log('removeResultType', arguments);
    delete this.state.query.resultTypes[rtKey];
    this.search();
  },

  setFilter: function (filter) {
    console.log('setFilter', arguments);
    if (!this.state.query.filters.hasOwnProperty(filter.fq)) {
      this.state.query.filters[filter.fq] = filter;
      this.search();
    }
  },

  toggleFilter: function (filter) {
    console.log('toggleFilter', arguments);
    delete this.state.query.filters[filter.fq];
    if (filter.exclude) {
      filter.exclude = false;
      filter.fq = filter.fq.replace(/-/, '');
    }
    else {
      filter.exclude = true;
      filter.fq = '-' + filter.fq;
    }
    this.state.query.filters[filter.fq] = filter;
    this.search();
  },

  setAllFilters: function (filters) {
    console.log('setAllFilters', arguments);
    this.state.query.filters = filters;
    this.search();
  },

  removeFilter: function (filter) {
    console.log('removeFilter', arguments);
    if (this.state.query.filters.hasOwnProperty(filter.fq)) {
      delete this.state.query.filters[filter.fq];
      this.search();
    }
  },

  removeFilters: function (predicate) {
    this.state.query.filters = _.omitBy(this.state.query.filters, predicate);
    this.search();
  },

  removeAllFilters: function () {
    console.log('removeAllFilters');
    this.setAllFilters({});
  },

  moreResults: function (howManyMore) {
    var listRt = this.state.query.resultTypes.list;
    if (listRt) {
      listRt.rows += howManyMore;
    }
    this.search();
  },

  setTaxon: function (taxonId, isSelect) {
    if (isSelect) {
      this.state.global.taxa[taxonId] = true;
    }
    else {
      delete this.state.global.taxa[taxonId];
    }
    this.search();
  },

  setTaxa: function (taxa) {
    this.state.global.taxa = taxa;
    this.search();
  },

  searchComplete: function (results) {
    console.log('Got data: ', results);
    this.addSpeciesNamesToResults(results);

    this.persistQueryState();

    this.state.results = results;
    this.trigger(this.state);
  },

  getSpeciesName: function(taxonId) {
    if(this.taxonIdToSpeciesName) {
      return this.taxonIdToSpeciesName[taxonId];
    }
  },

  addSpeciesNamesToResults: function (results) {
    if(results.list) {
      // species name is not present in the results at this time.
      // let's add it here.
      const addSpeciesName = (result, taxonPropName) => {
        if (!result) {
          throw new Error("Result is null");
        }
        const species = this.getSpeciesName(result[taxonPropName]);
        if (species) {
          const newPropName = taxonPropName.replace('taxon_id', 'species_name');
          result[newPropName] = species;
        }
      };

      _.forEach(results.list, (result) => {
        addSpeciesName(result, 'taxon_id');
        addSpeciesName(result, 'closest_rep_taxon_id');
        addSpeciesName(result, 'model_rep_taxon_id');
      })
    }
  },

  persistQueryState: function() {
    const newPersistState = {
      filters: trimFilters(this.state.query.filters),
      taxa: this.state.global.taxa
    };

    if (_.size(newPersistState.filters)
        || _.size(newPersistState.taxa)) {
      // update the URL hash
      persistState(newPersistState);
    }

    else {
      persistState({});
    }
  },

  searchError: function (error) {
    console.error('Error updating results', error.stack, error);
  }
});
