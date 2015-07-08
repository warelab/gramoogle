'use strict';



var promise = require('q');
var _ = require('lodash');

var testQ = 'TEST';
var testFieldName = 'meadow';
var testParams = {flowers: true};
var testResponse = {data: 'hello', metadata: {}};

var jasminePit = require('jasmine-pit');
jasminePit.install(global);
require('jasmine-expect');

describe('sanity test', function() {
  xit('should work', function() {
    expect(true).toBeTruthy();
  });

  xit('should be able to instantiate a reflux store', function() {
    var searchStore = require('../../scripts/stores/searchStore');

    expect(searchStore.state).toBeDefined();
    expect(searchStore.state.query.q).toBeEmptyString();
  });
});

describe('SearchStore', function () {

  xit('result of getInitialState function should be same as value of state parameter', function () {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    // when

    // then
    expect(searchStore.getInitialState()).toEqual(searchStore.state);
  });

  xit('should keep result of getInitialState function invocation in sync with state param', function () {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    spyOn(searchStore, 'search');

    // when
    searchStore.setQueryString(testQ);

    // then
    expect(searchStore.state.query.q).toEqual(testQ);
    expect(searchStore.getInitialState()).toEqual(searchStore.state);
  });

  xit('should invoke search function when query string changed', function () {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    spyOn(searchStore, 'search');
    //searchStore.search = jest.genMockFn();

    // when
    searchStore.setQueryString(testQ);

    // then
    expect(searchStore.state.query.q).toEqual(testQ);
    expect(searchStore.search).toHaveBeenCalled();
  });

  xit('should call search function every time an action that modifies the query state is invoked', function () {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    spyOn(searchStore, 'search');

    // when
    searchStore.setQueryString(testQ);
    searchStore.setQueryString(testQ);
    searchStore.setQueryString(testQ);
    searchStore.setResultType(testFieldName, testParams);
    searchStore.removeResultType(testFieldName);

    // then
    expect(searchStore.search.calls.length).toEqual(5);
  });

  xit('should invoke (mocked) search and update state on response when query string is changed', function () {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    searchStore.cache = require('gramene-client-cache').init(10);
    spyOn(searchStore.cache, 'get').andReturn(undefined);

    // we will be checking this was called
    spyOn(searchStore, 'searchComplete');
    spyOn(searchStore, 'searchError');
    spyOn(searchStore, 'searchPromise').andReturn(promise(testResponse));

    // when
    searchStore.searchNoDebounce();

    waitsFor(function() {
      return !!searchStore.searchComplete.calls.length;
    });

    runs(function() {
      // then
      expect(searchStore.searchComplete).toHaveBeenCalledWith(testResponse);
      expect(searchStore.searchError).not.toHaveBeenCalled();
    });
  });

  xit('should add the query at time of search invocation to metadata results', function() {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    var queryState = _.cloneDeep(searchStore.state.query);

    // we will be checking this was called
    spyOn(searchStore, 'searchComplete');
    spyOn(searchStore, 'searchError');
    spyOn(searchStore, 'searchPromise').andReturn(promise(testResponse));

    // when
    searchStore.searchNoDebounce();

    waitsFor(function() {
      return !!searchStore.searchComplete.calls.length;
    });

    runs(function() {
      // then
      expect(searchStore.searchComplete).toHaveBeenCalledWith(testResponse);
      expect(testResponse.metadata.searchQuery.q).toEqual(queryState.q);
    });

  });

  xit('should call searchError if something goes wrong in call to SOLR', function () {
    // given
    var searchStore = require('../../scripts/stores/searchStore');
    var anError = new Error('bummer');

    // we will be checking this was called
    spyOn(searchStore, 'searchComplete');
    spyOn(searchStore, 'searchError');

    // simulate failure
    searchStore.searchPromise = function () {
      return promise(function () {
        throw anError;
      });
    };

    // when
    searchStore.searchNoDebounce();

    waitsFor(function() {
      return !!searchStore.searchError.calls.length;
    });

    runs(function() {
      expect(searchStore.searchComplete).not.toHaveBeenCalled();
      expect(searchStore.searchError).toHaveBeenCalled();
    });
  });

});
