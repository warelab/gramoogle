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
    const result = _.isEmpty(_.get(this.state.search, 'query.filters'));

    // console.log('dontShowResults?', result, this.state);

    return result;
  }

  render() {
    var search = this.state.search,
      content = this.dontShowResults() ?
        this.props.children :
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