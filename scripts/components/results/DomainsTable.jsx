'use strict';

import React from "react";
import searchStore from "../../stores/searchStore";
import {resultTypes} from "gramene-search-client";
import QueryActions from "../../actions/queryActions";
import docStore from "../../stores/docStore";
import DocActions from "../../actions/docActions";
import ReactTable from 'react-table'


export default class DomainsTable extends React.Component {
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
  gatherDomainInfo(docs) {
    docs.forEach(d => {
      d.count = this.state.terms.data[d._id].count
    });
    this.setState({domains:docs})
  }
  componentDidUpdate(prevProps, prevState, snapshot) {
    if (this.state.terms && !prevState.terms) {
      console.log('requesting term ancestors from docstore',this.state.terms);
      var idList = this.state.terms.sorted.map(term => term.id);
      DocActions.needDocs(this.props.collection, idList, null, ids => this.gatherDomainInfo(ids), {fl:'_id,id,name,description',rows:-1});
    }
  }
  renderTable() {
    return (
      <ReactTable
        data={this.state.domains}
        columns={[
          {
            Header: 'Id',
            accessor: 'id'
          },
          {
            Header: 'Number of Genes',
            accessor: 'count'
          },
          {
            Header: 'Name',
            accessor: 'name'
          },
          {
            Header: 'Description',
            accessor: 'description'
          }
        ]}
      />
    )
  }
  render() {
    return (
      <div>
        <h1>{this.props.name}</h1>
        {/*<pre>{JSON.stringify(this.props,null,2)}</pre>*/}
        {/*<pre>{this.state.terms && JSON.stringify(this.state.terms,null,2)}</pre>*/}
        {this.state.domains && this.renderTable()}
      </div>
    );
  }
}

