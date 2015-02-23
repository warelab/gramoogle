'use strict';
jest.dontMock('../scripts/components/app.jsx');

describe('App', function() {
  var React = require('react/addons');
  var App = require('../scripts/components/app.jsx');
  var NewCharleyForm = require('../scripts/components/newCharleyForm.jsx');
  var CharleyList = require('../scripts/components/charleyList.jsx');
  var Charley = require('../scripts/components/charley.jsx');
  var TestUtils = React.addons.TestUtils;

  var newApp = function() {
    return TestUtils.renderIntoDocument(
      <App />
    );
  };

  it('should contain a form and a list of elements', function() {
    var app = newApp();

    var newCharleyForm = TestUtils.scryRenderedComponentsWithType(app, NewCharleyForm);
    var charleyList = TestUtils.scryRenderedComponentsWithType(app, CharleyList);

    expect(newCharleyForm.length).toEqual(1);
    expect(charleyList.length).toEqual(1);
  });

  //it('should add additional Charley components when a new one is added', function() {
  //  var app = newApp();
  //
  //  var charleys = TestUtils.scryRenderedComponentsWithType(app, Charley);
  //  expect(charleys.length).toEqual(1);
  //
  //  app.addNewCharley('another one');
  //  app.addNewCharley('and another');
  //
  //  charleys = TestUtils.scryRenderedComponentsWithType(app, Charley);
  //  expect(charleys.length).toEqual(3);
  //
  //  app.deleteCharley(2);
  //  app.deleteCharley(0);
  //
  //  charleys = TestUtils.scryRenderedComponentsWithType(app, Charley);
  //  expect(charleys.length).toEqual(1);
  //  expect(charleys[0].getDOMNode().textContent).toContain('another one');
  //});
});