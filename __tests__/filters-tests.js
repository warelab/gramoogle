'use strict';

jest.dontMock('../scripts/components/filters.jsx');
jest.dontMock('../scripts/components/searchSummary.jsx');
jest.dontMock('../scripts/components/filterPickers.jsx');
jest.dontMock('../scripts/stores/searchStore');

describe('Filters', function() {
  var React = require('react/addons');
  var searchStore = require('../scripts/stores/searchStore');
  var Filters = React.createFactory(require('../scripts/components/filters.jsx'));
  var TestUtils = React.addons.TestUtils;

  var newFilters = function() {
    var searchState = searchStore.getInitialState();
    return TestUtils.renderIntoDocument(Filters({query: searchState.query, results: searchState.results}));
  };

  xit('should contain a button', function() {
    var filters = newFilters();
    var button = TestUtils.scryRenderedDOMComponentsWithTag(filters, 'button');

    expect(button.length).toEqual(1);
  });

  xit('initially be in compact state', function() {
    var filters = newFilters();
    var summary = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filtersSummary');
    var details = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filterPickers');

    expect(filters.state.expanded).toEqual(false);
    expect(summary.length).toEqual(1);
    expect(details.length).toEqual(0);
  });

  xit('should toggle between states on button press', function() {
    var filters = newFilters();
    var button = TestUtils.findRenderedDOMComponentWithTag(filters, 'button');

    // click the button to expand.
    TestUtils.Simulate.click(button);

    var summary = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filtersSummary');
    var details = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filterPickers');

    expect(filters.state.expanded).toEqual(true);
    expect(summary.length).toEqual(0);
    expect(details.length).toEqual(1);

    // do it again to contract
    TestUtils.Simulate.click(button);

    summary = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filtersSummary');
    details = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filterPickers');

    expect(filters.state.expanded).toEqual(false);
    expect(summary.length).toEqual(1);
    expect(details.length).toEqual(0);

    // one more time
    TestUtils.Simulate.click(button);

    summary = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filtersSummary');
    details = TestUtils.scryRenderedDOMComponentsWithClass(filters, 'filterPickers');

    expect(filters.state.expanded).toEqual(true);
    expect(summary.length).toEqual(0);
    expect(details.length).toEqual(1);
  });
});