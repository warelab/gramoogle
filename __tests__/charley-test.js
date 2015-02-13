'use strict';
jest.dontMock('../scripts/components/charley.jsx');

describe('Charley', function() {
  var React = require('react/addons');
  var Charley = require('../scripts/components/charley.jsx');
  var TestUtils = React.addons.TestUtils;

  var theIndex = 1;
  var theSaying = 'The rain in Spain stays mainly in the plain';

  var newCharley = function(deleteFunction) {
    return TestUtils.renderIntoDocument(
      <Charley what={theSaying} index={theIndex} onDelete={deleteFunction} />
    );
  };

  it('should correctly create a saying for Charley', function() {
    var charleyEl = newCharley();

    var saying = TestUtils.findRenderedDOMComponentWithTag(charleyEl, 'figcaption');
    expect(saying.getDOMNode().textContent).toEqual('Charley Says "' + theSaying + '"');
  });

  it('should have an image with alt text and src', function() {
    // Render a checkbox with label in the document
    var charleyEl = newCharley();

    var image = TestUtils.findRenderedDOMComponentWithTag(charleyEl, 'img');
    expect(image.getDOMNode().src).toContain('charlie.jpg');
    expect(image.getDOMNode().alt).toEqual('Charlie Says…');
  });

  it('should invoke callback when delete button pressed', function() {
    var deleteWasCalled = false;
    var charleyEl = newCharley(function (deletedIndex) {
      deleteWasCalled = true;
      expect(deletedIndex).toEqual(theIndex);
    });

    var button = TestUtils.findRenderedDOMComponentWithTag(
      charleyEl, 'button');
    TestUtils.Simulate.click(button);

    expect(deleteWasCalled).toEqual(true);
  })
})