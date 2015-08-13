'use strict';

var Reflux = require('reflux');
var _ = require('lodash');
var Q = require('q');
var DetailsActions = require('../actions/detailsActions');
var searchStore = require('./searchStore');
var searchInterface = require('@warelab/gramene-search-client').client;

module.exports = Reflux.createStore({
  listenables: DetailsActions,

  init: function () {
    console.log('detailsStore init');
    this.listenTo(searchStore, this.updateDetails);
    this.activeCores = { // set in requireDetails, unset in forsakeDetails
      domains: 0,
      GO: 0,
      PO: 0,
      taxonomy: 0,
      genetrees: 0
    };
    this.detailsField = { // for each core, the field to gather ids from
      domains: 'domainList',
      GO: 'GO_xrefi',
      PO: 'PO_xrefi',
      taxonomy: 'taxon_id',
      genetrees: 'grm_gene_tree'
    };
    this.details = { // for each core, keys are ids, values are mongodb docs
      domains: {},
      GO: {},
      PO: {},
      taxonomy: {},
      genetrees: {}
    };
    this.fetch = _.debounce(this.fetchNoDebounce, 200);
  },
  updateDetails: function (searchState) {
    for (var core in this.activeCores) {
      if (this.activeCores[core]) {
        var idSet = {}; // gather from searchState.results docs this.detailsField[core]
        var idField = this.detailsField[core];
        searchState.results.list.forEach(function(doc) {
          if (doc.hasOwnProperty(idField)) {
            if (Array.isArray(doc[idField])) {
              doc[idField].forEach(function(id) {
                idSet[id]=1;
              });
            }
            else {
              idSet[doc[idField]]=1;
            }
          }
        });
        this.fetch(core,Object.keys(idSet));
      }
    }
  },
  requireDetails: function (core) {
    this.activeCores[core]++;
    //this.trigger(this.details);
  },
  forsakeDetails: function (core) {
    this.activeCores[core] = Math.max(0, --this.activeCores[core]);
  },

  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  fetchNoDebounce: function (core,idList) {
    console.log('performing fetch',core,idList);

    var uncached = [];
    var cache = this.details[core];
    idList.forEach(function(id) {
      if (!cache.hasOwnProperty(id)) {
        uncached.push(id);
      }
    });

    // if we have any uncached ids, we need to
    // ask the server for some data, otherwise we will
    // just use what we have
    var promise;
    if(uncached.length) {
      promise = this.searchPromise(core,uncached)

        // when we get data from the server, put it in the
        // cache
        .then(function (data) {
          for(var id in data) {
            data[id] = data[id][0];
          }
          _.assign(this.details[core],data);
        }.bind(this));
    }
    else {
      promise = this.nullSearchPromise();
    }

    promise
      .then(this.searchComplete)
      .catch(this.searchError);
  },

  searchPromise: function(core,idList) {
    console.log('asking '+core+' search interface for ', idList);
    return searchInterface.coreLookup(core,idList);
  },

  nullSearchPromise: function() {
    console.log('remote query not required');
    return Q(this.details);
    // return Q.fcall(function () {
//       console.log('remote query not required');
//       return cached;
//     });
  },

  searchComplete: function () {
    console.log('Got details', this.details);
    this.trigger(this.details);
  },

  searchError: function (error) {
    console.error('Error updating results', error);
  }
});
