'use strict';

jest.dontMock('../scripts/components/app.jsx');
jest.dontMock('../scripts/components/textSearch.jsx');
jest.dontMock('../scripts/components/filters.jsx');
jest.dontMock('../scripts/components/results.jsx');
jest.dontMock('../scripts/stores/searchStore');

describe('App', function() {
  var React = require('react/addons');
  var App = React.createFactory(require('../scripts/components/app.jsx'));
  var TextSearch = React.createFactory(require('../scripts/components/textSearch.jsx'));
  var Filters = React.createFactory(require('../scripts/components/filters.jsx'));
  var Results = React.createFactory(require('../scripts/components/results.jsx'));
  var TestUtils = React.addons.TestUtils;

  var newApp = function() {
    return TestUtils.renderIntoDocument(App());
  };

  it('should contain the expected components', function() {
    var app = newApp();

    var textSearch = TestUtils.scryRenderedComponentsWithType(app, TextSearch);
    var filters = TestUtils.scryRenderedComponentsWithType(app, Filters);
    var results = TestUtils.scryRenderedComponentsWithType(app, Results);

    expect(textSearch.length).toEqual(1);
    expect(filters.length).toEqual(1);
    expect(results.length).toEqual(1);
  });

  it('should have state populated from store', function() {
    var app = newApp();

    expect(app.state.search).toBeDefined();
    expect(app.state.search.query).toBeDefined();
    expect(app.state.search.results).toBeDefined();
  });
});