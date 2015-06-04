'use strict';

jest.dontMock('../scripts/components/analysis.jsx');
jest.dontMock('../scripts/components/searchSummary.jsx');
jest.dontMock('../scripts/components/analysisPickers.jsx');
jest.dontMock('../scripts/stores/searchStore');

describe('Analysis', function() {
  var React = require('react/addons');
  var searchStore = require('../scripts/stores/searchStore');
  var Analysis = React.createFactory(require('../scripts/components/analysis.jsx'));
  var TestUtils = React.addons.TestUtils;

  var newAnalysis = function() {
    var searchState = searchStore.getInitialState();
    return TestUtils.renderIntoDocument(Analysis({query: searchState.query, results: searchState.results}));
  };

  xit('should contain a button', function() {
    var analysis = newAnalysis();
    var button = TestUtils.scryRenderedDOMComponentsWithTag(analysis, 'button');

    expect(button.length).toEqual(1);
  });

  xit('initially be in compact state', function() {
    var analysis = newanalysis();
    var summary = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisSummary');
    var details = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisPickers');

    expect(analysis.state.expanded).toEqual(false);
    expect(summary.length).toEqual(1);
    expect(details.length).toEqual(0);
  });

  xit('should toggle between states on button press', function() {
    var analysis = newanalysis();
    var button = TestUtils.findRenderedDOMComponentWithTag(analysis, 'button');

    // click the button to expand.
    TestUtils.Simulate.click(button);

    var summary = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisSummary');
    var details = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisPickers');

    expect(analysis.state.expanded).toEqual(true);
    expect(summary.length).toEqual(0);
    expect(details.length).toEqual(1);

    // do it again to contract
    TestUtils.Simulate.click(button);

    summary = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisSummary');
    details = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisPickers');

    expect(analysis.state.expanded).toEqual(false);
    expect(summary.length).toEqual(1);
    expect(details.length).toEqual(0);

    // one more time
    TestUtils.Simulate.click(button);

    summary = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisSummary');
    details = TestUtils.scryRenderedDOMComponentsWithClass(analysis, 'analysisPickers');

    expect(analysis.state.expanded).toEqual(true);
    expect(summary.length).toEqual(0);
    expect(details.length).toEqual(1);
  });
});