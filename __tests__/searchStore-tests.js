'use strict';

jest.dontMock('../scripts/stores/searchStore');
jest.dontMock('q');
jest.dontMock('lodash');

var promise = require('q');
var _ = require('lodash');

var testQ = 'TEST';
var testFieldName = 'meadow';
var testParams = {flowers: true};
var testResponse = {data: 'hello', metadata: {}};

describe('SearchStore', function () {

  it('result of getInitialState function should be same as value of state parameter', function () {
    // given
    var searchStore = require('../scripts/stores/searchStore');

    // when

    // then
    expect(searchStore.getInitialState()).toEqual(searchStore.state);
  });

  it('should keep result of getInitialState function invocation in sync with state param', function () {
    // given
    var searchStore = require('../scripts/stores/searchStore');
    searchStore.search = jest.genMockFn();

    // when
    searchStore.setQueryString(testQ);

    // then
    expect(searchStore.state.query.q).toEqual(testQ);
    expect(searchStore.getInitialState()).toEqual(searchStore.state);
  });

  it('should invoke search function when query string changed', function () {
    // given
    var searchStore = require('../scripts/stores/searchStore');
    searchStore.search = jest.genMockFn();

    // when
    searchStore.setQueryString(testQ);

    // then
    expect(searchStore.state.query.q).toEqual(testQ);
    expect(searchStore.search).toBeCalled();
  });

  it('should call search function every time an action that modifies the query state is invoked', function () {
    // given
    var searchStore = require('../scripts/stores/searchStore');
    searchStore.search = jest.genMockFn();

    // when
    searchStore.setQueryString(testQ);
    searchStore.setQueryString(testQ);
    searchStore.setQueryString(testQ);
    searchStore.setResultType(testFieldName, testParams);
    searchStore.removeResultType(testFieldName);

    // then
    expect(searchStore.search.mock.calls.length).toEqual(5);
  });

  it('should invoke (mocked) search and update state on response when query string is changed', function () {
    // given
    var searchStore = require('../scripts/stores/searchStore');

    // we will be checking this was called
    searchStore.searchComplete = jest.genMockFn();
    searchStore.searchError = jest.genMockFn();

    // disable calls to SOLR service
    searchStore.searchPromise = function () {
      return promise(testResponse)
    };

    // when
    searchStore.searchNoDebounce();
    jest.runAllTimers();

    // then
    expect(searchStore.searchComplete).toBeCalledWith(testResponse);
    expect(searchStore.searchError).not.toBeCalled();
  });

  it('should add the query at time of search invocation to metadata results', function() {
    // given
    var searchStore = require('../scripts/stores/searchStore');
    var queryState = _.cloneDeep(searchStore.state.query);

    // we will be checking this was called
    searchStore.searchComplete = jest.genMockFn();
    searchStore.searchError = jest.genMockFn();

    // disable calls to SOLR service
    searchStore.searchPromise = function () {
      return promise(testResponse)
    };

    // when
    searchStore.searchNoDebounce();
    jest.runAllTimers();

    // then
    expect(searchStore.searchComplete).toBeCalledWith(testResponse);
    expect(testResponse.metadata.searchQuery).toEqual(queryState);
  });

  it('should call searchError if something goes wrong in call to SOLR', function () {
    // given
    var searchStore = require('../scripts/stores/searchStore');
    var anError = new Error('bummer');

    // we will be checking this was called
    searchStore.searchComplete = jest.genMockFn();
    searchStore.searchError = jest.genMockFn();

    // simulate failure
    searchStore.searchPromise = function () {
      return promise(function () {
        throw anError;
      });
    };

    // when
    searchStore.searchNoDebounce();
    jest.runAllTimers();

    // then
    expect(searchStore.searchComplete).not.toBeCalled();
    expect(searchStore.searchError).toBeCalled();
  });

});
