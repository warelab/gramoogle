'use strict';
jest.dontMock('../scripts/components/charleyList.jsx');

describe('CharleyList', function() {
  var React = require('react/addons');
  var CharleyList = require('../scripts/components/charleyList.jsx');
  var TestUtils = React.addons.TestUtils;

  var theSayings = ['The rain in Spain stays mainly in the plain', 'React'];

  var newCharleyList = function(deleteFunction) {
    return TestUtils.renderIntoDocument(
      <CharleyList sayings={theSayings} onDelete={deleteFunction} />
    );
  };

  it('should correctly create an ordered list', function() {
    var charleyListEl = newCharleyList();

    var ol = TestUtils.findRenderedDOMComponentWithTag(charleyListEl, 'ol');
    expect(ol.props.children.length).toEqual(theSayings.length);
  });

  it('should invoke callback when deleteCharley is pressed', function() {
    var deleteWasCalled = false;
    var exampleIndex = 1;
    var charleyListEl = newCharleyList(function (deletedIndex) {
      deleteWasCalled = true;
      expect(deletedIndex).toEqual(exampleIndex);
    });

    charleyListEl.deleteCharley(exampleIndex);

    expect(deleteWasCalled).toEqual(true);
  })
});