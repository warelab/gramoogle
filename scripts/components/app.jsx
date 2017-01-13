'use strict';

import React from 'react';
import Header from './header.jsx';
import Footer from './footer/Footer.jsx';
import Results from './results/results.jsx';
import Welcome from './welcome/WelcomePage.jsx';
import searchStore from '../stores/searchStore';
import drupalStore from '../stores/drupalStore';
import _ from 'lodash';

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      search: searchStore.state,
      drupal: drupalStore.state
    };
  }

  componentWillMount() {
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
        this.setState({search: searchState})
    );
    this.unsubscribeFromDrupalStore = drupalStore.listen((drupalState) =>
        this.setState({drulap: drupalState})
    );
  }

  componentWillUnmount() {
    this.unsubscribeFromSearchStore();
    this.unsubscribeFromDrupalStore();
  }
  
  dontShowResults() {
    // don't show the results if there are no user-specified filters 
    return _.isEmpty(_.get(this.state.search, 'query.filters'));
  }

  render() {
    var search = this.state.search,
      content = this.dontShowResults() ?
        <Welcome context="client" /> :
        <Results results={search.results}/>
      ;

    return (
      <div className="app">
        <Header search={search}/>
        {content}
        <Footer />
      </div>
    );
  }
};

module.exports = App;