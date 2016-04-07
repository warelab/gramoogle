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

const QUERY_STRING_MISMATCH_ERROR = 'query string mismatch';

module.exports = Reflux.createStore({
  init: function () {
    this.listenTo(QueryActions.setQueryString, this.provideSuggestions);
    this.listenTo(visualizationStore, this.setTaxonomy);
    this.listenTo(searchStore, this.setSearchState);
    this.setSearchState(searchStore.state);
    this.cache = GrameneCache.init(100);

    this.suggest = _.debounce(this.suggestNoDebounce, constants.suggest.debounce);
  },

  provideSuggestions: function (queryString) {
    //queryString = queryString.replace(/\s/g, '*');
    console.log('provideSuggestions', queryString);
    this.suggest(queryString);
  },

  setTaxonomy: function (visState) {
    this.taxonomy = visState.taxonomy;
  },

  setSearchState: function (searchState) {
    this.searchState = searchState;
  },

  // Note that this function is debounced in init. It might be called many
  // times in succession when a user is interacting with the page,
  // but only the last one will fire.
  suggestNoDebounce: function (queryString) {
    console.log('performing suggest', queryString);

    var cached = this.cache.get(queryString);
    var promise;

    if (cached) {
      console.log('got results for ' + queryString + ' from cache');
      promise = Q(_.cloneDeep(cached));
    }
    else {
      // we use this in checkResponseQueryString
      this.mostRecentlyRequestedQueryString = queryString;

      promise = this.suggestPromise(queryString)
        .then(this.checkResponseQueryString)
        .then(this.addCategoryClassNames)
        .then(function addToCache(response) {
          this.cache.set(queryString, _.cloneDeep(response));
          return response;
        }.bind(this));
      console.log('going to hit server for suggestions for ' + queryString);
    }

    promise
      .then(this.removeAcceptedSuggestions)
      .then(this.findTopSuggestions)
      .then(this.addQueryTermFactory(queryString))
      .then(this.suggestComplete)
      .catch(this.suggestError);
  },

  checkResponseQueryString: function(data) {
    if(data.metadata.query != this.mostRecentlyRequestedQueryString) {
      throw new Error(QUERY_STRING_MISMATCH_ERROR);
    }
    return data.categories;
  },

  removeAcceptedSuggestions: function (data) {
    var accepted = this.searchState.query.filters;
    var result = _.forEach(data, function (category) {
      category.suggestions = _.filter(category.suggestions, function (suggestion) {
        return !accepted[suggestion.fq];
      });
    });
    return result;
  },

  addQueryTermFactory: function addQueryTermFactory(queryString) {
    const GENES_CATEGORY = 'Gene';
    return function addQueryTerm(data) {
      var exact, beginsWith, textCategory;

      exact = {
        id: 'exact',
        category: GENES_CATEGORY,
        term: 'Exactly "' + queryString + '"',
        fq: 'text:' + queryString,
        display_name: 'All genes that contain the word "' + queryString + '"'
      };

      beginsWith = {
        id: 'startsWith',
        category: GENES_CATEGORY,
        term: 'Starts with "' + queryString + '"',
        fq: 'text:' + queryString + '*',
        display_name: 'All genes that contain a word that starts with "' + queryString + '"'
      };

      textCategory = _.find(data, function (category) {
        return category.label === GENES_CATEGORY;
      });

      if (!textCategory) {
        textCategory = {
          label: 'Gene',
          numFound: 0,
          maxScore: 0,
          suggestions: [],
          fullTextSearchOnly: true
        }

        data.push(textCategory);
      }

      textCategory.suggestions.push(exact, beginsWith);

      return data;
    }.bind(this);
  },

  addCategoryClassNames: function addCategoryClassNames(categories) {
    return _.map(categories, function (category) {
      category.className = category.label.toLowerCase().replace(/\s/g, '-');
      return category;
    });
  },

  findTopSuggestions: function findTopSuggestions(data) {
    const NUM_TOP = 5;

    // only create a "top5" category if there is more than one category of suggestions returned.
    // If only one is returned, the "top5" suggestions would simply be the first 5 of that category.
    if(data.length > 1) {
      var top5 = _.reduce(data, function lookInEachCategoryForBestSuggestions(top, category) {
        var result, arrA, arrB, a, b;

        // if there are no top suggestions, just take the first 5 from the category
        if (_.isEmpty(top)) {
          return _.take(category.suggestions, NUM_TOP);
        }

        // we can check if nothing in this category can get into the top.
        if (category.maxScore <= _.last(top).score) {
          return top;
        }

        result = [];
        arrA = top.slice();
        arrB = category.suggestions.slice();

        // while we don't have NUM_TOP and there are still suggestions available
        while (result.length < NUM_TOP && (arrA.length || arrB.length)) {
          a = arrA.shift(), b = arrB.shift();
          if (!b) {
            result.push(a);
          }
          else if (!a) {
            result.push(b);
          }
          else {
            result.push(b.score > a.score ? b : a);
          }
        }

        return result;
      }, []);

      if (top5.length) {
        data.unshift({label: 'Top', suggestions: top5});
      }
    }

    return data;
  },

  suggestPromise: function (queryString) {
    return searchInterface.suggest(queryString);
  },

  suggestComplete: function (results) {
    console.log('Got data: ', results);
    this.trigger(results);
  },

  suggestError: function (error) {
    if(error.message === QUERY_STRING_MISMATCH_ERROR) {
      console.warn("Suggest store got out-of-order suggestion response", error);
    }
    else {
      console.error('Error in suggest', error);
    }
  }
});
