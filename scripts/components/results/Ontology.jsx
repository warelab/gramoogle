'use strict';

import React from "react";
import searchStore from "../../stores/searchStore";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
import docStore from "../../stores/docStore";
import DocActions from "../../actions/docActions";
import _ from 'lodash';


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
  buildHierarchy(docs) {
    docs.forEach(d => {
      d.count = this.state.terms.data[d._id].count
    });
    console.log("buildHierarchy",docs);
    this.setState({hierarchy:docs})
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.terms && !prevState.terms) {
      console.log('requesting term ancestors from docstore',this.state.terms);
      var idList = this.state.terms.sorted.map(term => term.id);
      DocActions.needDocs(this.props.collection, idList, null, ids => this.buildHierarchy(ids), {fl:'_id,id,name,description,is_a',rows:-1});
    }
  }
  render() {
    return (
      <div>
        <h1>{this.props.name}</h1>
        {/*<pre>{JSON.stringify(this.props,null,2)}</pre>*/}
        {/*<pre>{this.state.terms && JSON.stringify(this.state.terms,null,2)}</pre>*/}
        <pre>{this.state.hierarchy && JSON.stringify(this.state.hierarchy, null, 2)}</pre>
      </div>
    );
  }
}

