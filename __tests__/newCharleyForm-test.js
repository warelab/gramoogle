'use strict';
jest.dontMock('../scripts/components/newCharleyForm.jsx');

describe('NewCharleyForm', function() {
  var React = require('react/addons');
  var NewCharleyForm = require('../scripts/components/newCharleyForm.jsx');
  var TestUtils = React.addons.TestUtils;

  var newCharleyForm = function(handleNewCharleyFunction) {
    return TestUtils.renderIntoDocument(
      <NewCharleyForm onNewCharley={handleNewCharleyFunction} />
    );
  };

  it('should contain a label, a text input and a button', function() {
    var form = newCharleyForm();

    var els = {
      label: TestUtils.findRenderedDOMComponentWithTag(form, 'label'),
      input: TestUtils.findRenderedDOMComponentWithTag(form, 'input'),
      button: TestUtils.findRenderedDOMComponentWithTag(form, 'button')
    };

    expect(els.label.getDOMNode().textContent).toEqual('What should Charley say?');
    expect(els.input.getDOMNode().textContent).toEqual('');
    expect(els.button.getDOMNode().textContent).toEqual('New Charley');
  });

  it('should call the callback when the "New Charley" button is pressed', function() {
    var callbackWasCalled = false;
    var saying = 'TEST';
    var component = newCharleyForm(function(passedSaying) {
      callbackWasCalled = true;
      expect(passedSaying).toEqual(saying);
    });
    var form = TestUtils.findRenderedDOMComponentWithTag(component, 'form');
    var input = TestUtils.findRenderedDOMComponentWithTag(form, 'input');
    input.getDOMNode().value = saying;

    TestUtils.Simulate.submit(form);

    expect(callbackWasCalled).toEqual(true);
  });
});