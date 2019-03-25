'use strict';

import React from "react";
import searchStore from "../../stores/searchStore";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";


export default class Ontology extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  componentWillMount() {
    QueryActions.setResultType(this.props.facet, resultTypes.get('distribution',{
      'facet.field' : this.props.facet
    }));
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) =>
      this.setState({terms: searchState.results[this.props.facet]})
    );

  }
  componentWillUnmount() {
    QueryActions.removeResultType(this.props.facet);
    this.unsubscribeFromSearchStore();
  }

  render() {
    return (
      <div>
        <h1>{this.props.name}</h1>
        <pre>{JSON.stringify(this.props)}</pre>
        <pre>{this.state.terms && JSON.stringify(this.state.terms)}</pre>
      </div>
    );
  }
}

