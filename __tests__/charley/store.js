'use strict';
jest.dontMock('../../scripts/stores/charleyStore.js');

describe('CharleyStore', function() {
  var charleyStore;

  beforeEach(function() {
    charleyStore = require('../../scripts/stores/charleyStore');
    charleyStore.getInitialState();
  });

  it('should have a single saying in initial state', function() {
    expect(charleyStore.sayings.length).toEqual(1);
  });

  it('should add a new saying', function() {
    var newSaying = 'prodigy';
    var mockFunction = jest.genMockFn();
    charleyStore.listen(mockFunction);

    // when
    charleyStore.onAddCharley(newSaying);

    // then
    expect(charleyStore.sayings.length).toEqual(2);
    expect(mockFunction).toBeCalledWith(charleyStore.sayings);
  });

  it('should remove a saying', function() {
    var mockFunction = jest.genMockFn();
    charleyStore.listen(mockFunction);

    // when
    charleyStore.onDeleteCharley(0);

    // then
    expect(charleyStore.sayings.length).toEqual(0);
    expect(mockFunction).toBeCalledWith(charleyStore.sayings);
  });
});