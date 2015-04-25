'use strict';

jest.autoMockOff();

describe('Filters', function() {
  var React = require('react/addons');
  var searchStore = require('../scripts/stores/searchStore');
  var _ = require('lodash');
  var Results = React.createFactory(require('../scripts/components/results'));
  var TestUtils = React.addons.TestUtils;

  var newResults = function() {
    var searchState = searchStore.getInitialState();
    return TestUtils.renderIntoDocument(Results({results: searchState.results}));
  };

  xit('initially be display result overview visualization', function() {
    var results = newResults();
    var radios = TestUtils.scryRenderedDOMComponentsWithTag(results, 'input');

    var selectedRadio = _.find(radios, function(radio) {
      return radio.props.checked;
    });

    expect(selectedRadio.props.value).toEqual(results.VIZ);
    expect(results.state.visible).toEqual(results.VIZ);
  });

  xit('should switch to list state on radio button press', function() {
    // given
    var results = newResults();
    var radios = TestUtils.scryRenderedDOMComponentsWithTag(results, 'input');
    var listRadio = _.find(radios, function(radio) {
      return radio.props.value === results.LIST;
    });

    // when
    TestUtils.Simulate.change(listRadio, {target: listRadio.props});

    // then
    var list = TestUtils.scryRenderedDOMComponentsWithClass(results, 'resultsList');
    var viz = TestUtils.scryRenderedDOMComponentsWithClass(results, 'resultsVis');

    expect(results.state.visible).toEqual(results.LIST);
    expect(list.length).toEqual(1);
    expect(viz.length).toEqual(0);
  });
});