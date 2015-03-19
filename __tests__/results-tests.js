'use strict';

jest.dontMock('../scripts/components/results.jsx');

describe('Filters', function() {
  var React = require('react/addons');
  var searchStore = require('../scripts/stores/searchStore');
  var _ = require('lodash');
  var Results = React.createFactory(require('../scripts/components/results.jsx'));
  var ResultsList = React.createFactory(require('../scripts/components/resultsList.jsx'));
  var ResultsViz = React.createFactory(require('../scripts/components/resultsVisualization.jsx'));
  var TestUtils = React.addons.TestUtils;

  var newResults = function() {
    var searchState = searchStore.getInitialState();
    return TestUtils.renderIntoDocument(Results({results: searchState.results}));
  };

  it('initially be display result overview visualization', function() {
    var results = newResults();
    var radios = TestUtils.scryRenderedDOMComponentsWithTag(results, 'input');

    var selectedRadio = _.find(radios, function(radio) {
      return radio.props.checked;
    });
    var list = TestUtils.scryRenderedComponentsWithType(results, ResultsList);
    var viz = TestUtils.scryRenderedComponentsWithType(results, ResultsViz);

    expect(selectedRadio.props.value).toEqual(results.VIZ);
    expect(results.state.visible).toEqual(results.VIZ);
    expect(list.length).toEqual(0);
    expect(viz.length).toEqual(1);
  });

  it('should switch to list state on radio button press', function() {
    // given
    var results = newResults();
    var radios = TestUtils.scryRenderedDOMComponentsWithTag(results, 'input');
    var listRadio = _.find(radios, function(radio) {
      return radio.props.value = results.LIST;
    });

    // when
    TestUtils.Simulate.change(listRadio, {target: listRadio.props});

    // then
    var list = TestUtils.scryRenderedComponentsWithType(results, ResultsList);
    var viz = TestUtils.scryRenderedComponentsWithType(results, ResultsViz);

    expect(results.state.visible).toEqual(results.LIST);
    expect(list.length).toEqual(1);
    expect(viz.length).toEqual(0);
  });
});