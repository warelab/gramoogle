'use strict';

import React from 'react';
import Header from './header.jsx';
import Results from './results/results.jsx';
import Welcome from './welcome/Welcome.jsx';
import searchStore from '../stores/searchStore';
import _ from 'lodash';

export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      search: searchStore.state
    };
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
      </div>
    );
  }
};

module.exports = App;