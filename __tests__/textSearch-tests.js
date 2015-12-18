'use strict';

jest.dontMock('../scripts/components/search.jsx');

describe('TextSearch', function() {
  var React = require('react/addons');
  var TextSearch = React.createFactory(require('../scripts/components/search/search.jsx'));
  var TestUtils = React.addons.TestUtils;

  var searchActions = require('../scripts/actions/queryActions');
  var testString = 'TEST';

  var newTextSearch = function() {
    return TestUtils.renderIntoDocument(TextSearch({query:{q:testString}}));
  };

  xit('should contain a text box', function() {
    var search = newTextSearch();

    var textBoxes = TestUtils.scryRenderedDOMComponentsWithTag(search, 'input');

    expect(textBoxes.length).toEqual(1);
  });

  xit('should display the passed in query string in the text box', function() {
    var search = newTextSearch();
    var textBox = TestUtils.findRenderedDOMComponentWithTag(search, 'input');

    expect(textBox.getDOMNode().value).toEqual(testString);
  });

  xit('should call the appropriate action when the query string is changed', function() {
    var search = newTextSearch();
    var textBox = search.refs.searchBox.getDOMNode();
    var anotherTestString = 'TESTY TEST TEST';

    searchActions.setQueryString = jest.genMockFn();

    TestUtils.Simulate.change(textBox, {target: {value: anotherTestString}});
    //textBox.value = anotherTestString

    expect(textBox.getAttribute('value')).toEqual(anotherTestString);
    expect(searchActions.setQueryString.mock.calls.length).toBe(1);
    expect(searchActions.setQueryString).toBeCalledWith(anotherTestString);
  });
});