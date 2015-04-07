'use strict';

jest.autoMockOff();

describe('App', function() {
  var React = require('react/addons');
  var App = React.createFactory(require('../scripts/components/app.jsx'));
  var TestUtils = React.addons.TestUtils;

  var newApp = function() {
    return TestUtils.renderIntoDocument(App());
  };

  it('should contain the expected components', function() {
    var app = newApp();

    var textSearch = TestUtils.scryRenderedDOMComponentsWithClass(app, 'search');
    var filters = TestUtils.scryRenderedDOMComponentsWithClass(app, 'filters');
    var results = TestUtils.scryRenderedDOMComponentsWithClass(app, 'results');

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