'use strict';

var jasminePit = require('jasmine-pit');
jasminePit.install(global);
require('jasmine-expect');

describe('sanity test', function() {
  it('should work', function() {
    expect(true).toBeTruthy();
  });

  it('should be able to instantiate a reflux store', function() {
    var searchStore = require('../../scripts/stores/searchStore');

    expect(searchStore.state).toBeDefined();
    expect(searchStore.state.query.q).toBeEmptyString();
  });
});