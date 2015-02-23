'use strict';
jest.dontMock('../../scripts/components/newCharleyForm.jsx');

describe('NewCharleyForm', function() {
  var React = require('react/addons');
  var NewCharleyForm = require('../../scripts/components/newCharleyForm.jsx');
  var charleyActions = require('../../scripts/actions/charleyActions');
  var TestUtils = React.addons.TestUtils;

  var newCharleyForm = function() {
    return TestUtils.renderIntoDocument(
      <NewCharleyForm />
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

  it('should invoke CharleyActions.addCharley when the "New Charley" button is pressed', function() {
    var saying = 'TEST';
    var component = newCharleyForm();
    var form = TestUtils.findRenderedDOMComponentWithTag(component, 'form');
    var input = TestUtils.findRenderedDOMComponentWithTag(form, 'input');
    input.getDOMNode().value = saying;
    charleyActions.addCharley = jest.genMockFn();

    expect(charleyActions.addCharley).not.toBeCalled();

    TestUtils.Simulate.submit(form);

    expect(charleyActions.addCharley.mock.calls.length).toBe(1);
    expect(charleyActions.addCharley).toBeCalledWith(saying);
  });
});