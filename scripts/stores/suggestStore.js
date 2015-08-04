'use strict';

var Reflux = require('reflux');
var QueryActions = require('../actions/queryActions');
var _ = require('lodash');
var Q = require('q');
var searchInterface = require('gramene-search-client').client;
var SuggestActions = require('../actions/suggestActions');
var GrameneCache = require('gramene-client-cache');
var visualizationStore = require('../stores/visualizationStore');
var searchStore = require('../stores/searchStore');
var constants = require('../config/constants');

module.exports = Reflux.createStore({
  init: function () {
    this.listenTo(QueryActions.setQueryString, this.provideSuggestions);
    this.listenTo(visualizationStore, this.setTaxonomy);
    this.listenTo(searchStore, this.setSearchState);
    this.cache = GrameneCache.init(100);

    this.suggest = _.debounce(this.suggestNoDebounce, constants.suggest.debounce);
  },

  provideSuggestions: function (queryString) {
    queryString = queryString.replace(/\s/g, '*');
    console.log('provideSuggestions', queryString);
    this.suggest(queryString);
  },

  setTaxonomy: function(visState) {
    this.taxonomy = visState.taxonomy;
  },

  setSearchState: function(searchState) {
    this.searchState = searchState;
  },

  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  suggestNoDebounce: function (queryString) {
    console.log('performing suggest', queryString);

    var cached = this.cache.get(queryString);
    var promise;

    if(cached) {
      console.log('got results for ' + queryString + ' from cache');
      promise = Q(cached);
    }
    else {
      promise = this.suggestPromise(queryString)
        .then(function addToCache(response) {
          this.cache.set(queryString, _.cloneDeep(response));
          return response;
        }.bind(this));
      console.log('going to hit server for suggestions for ' + queryString);
    }

    promise
      .then(this.removeAcceptedSuggestions)
      .then(this.addQueryTermFactory(queryString))
      .then(this.addCategoryClassNames)
      .then(this.findTopSuggestions)
      .then(this.suggestComplete)
      .catch(this.suggestError);
  },

  removeAcceptedSuggestions: function(data) {
    var accepted = this.searchState.query.filters;
    var result = _.forEach(data, function(category) {
      category.suggestions = _.filter(category.suggestions, function(suggestion) {
        return !accepted[suggestion.fq];
      });
    });
    return result;
  },

  addQueryTermFactory: function(queryString) {
    return function(data) {
      var exact, beginsWith, textCategory;
      
      exact = {
        term: 'Exactly "' + queryString + '"',
        fq: 'text:' + queryString,
        label: 'Exactly "' + queryString + '"'
      };
        
      beginsWith = {
        term: 'Starts with "' + queryString + '"',
        fq: 'text:' + queryString + '*',
        label: 'Starts with "' + queryString + '"'
      };
      
      textCategory = _.find(data, function(category) {
        return category.label === 'Text search';
      });
      
      _.remove(textCategory.suggestions, function(suggestion) {
        return suggestion.label === queryString;
      });
      
      // .splice mutates the existing array.
      textCategory.suggestions.splice(0, 0, exact, beginsWith);
      
      return data;
    }.bind(this);
  },

  addCategoryClassNames: function(data) {
    return _.map(data, function(category) {
      category.className = category.label.toLowerCase().replace(/\s/g, '-');
      return category;
    });
  },

  findTopSuggestions: function(data) {

    function defaultScoreFunc(suggestion) {
      return suggestion.weight || 1;
    }
    function goScoreFunc(suggestion) {
      return -suggestion.weight;
    }
    var scoreFuncs = {
      Taxonomy: function(suggestion) {
        var defaultScore = defaultScoreFunc(suggestion),
            taxonomy = this.taxonomy || visualizationStore.taxonomy;

        if(taxonomy) {
          var taxon_id = +suggestion.id.substring(10);
          var taxon = taxonomy.indices.id[taxon_id];
          var isASpecies = !taxon.children.length;
          return defaultScore * (isASpecies ? 1000 : 1);
        }
        else {
          return defaultScore;
        }
      }.bind(this),
      'GO component': goScoreFunc,
      'GO function': goScoreFunc,
      'GO process': goScoreFunc
    };

    var top5 = _.chain(data)
      .map(function(category) {
        _.forEach(category.suggestions, function(suggestion) {
          suggestion.category = category.label;
          var scoreFunc = scoreFuncs[suggestion.category] || defaultScoreFunc;
          suggestion.score = scoreFunc(suggestion);

        });
        return category.suggestions;
      })
      .flatten()
      .filter(function(suggestion) {
        return suggestion.weight > 0;
      })
      .sortBy(function(suggestion) {
        return -suggestion.score;
      })
      .take(5)
      .value();
    data.unshift({label: 'Top', suggestions: top5});
    return data;
  },

  suggestPromise: function(queryString) {
    return searchInterface.suggest(queryString);
  },

  suggestComplete: function (results) {
    console.log('Got data: ', results);
    this.trigger(results);
  },

  suggestError: function (error) {
    console.error('Error in suggest', error);
  }
});
