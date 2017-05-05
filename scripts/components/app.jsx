'use strict';

import React from 'react';
import Header from './header.jsx';
import Footer from './footer/Footer.jsx';
import Results from './results/results.jsx';
import searchStore from '../stores/searchStore';
import _ from 'lodash';

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {};
  }

  componentWillMount() {
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
        this.setState({search: searchState})
    );
  }

  componentWillUnmount() {
    this.unsubscribeFromSearchStore();
  }
  
  dontShowResults() {
    // don't show the results if there are no user-specified filters
    return _.isEmpty(_.get(this.state, 'search.query.filters'));
  }

  render() {
    let content = this.dontShowResults() ?
        this.props.children :
        <Results />
      ;

    return (
      <div className="app">
        <Header />
        {content}
        <Footer />
      </div>
    );
  }
};

module.exports = App;