'use strict';

/* @flow */

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');
var queryActions = require('../../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;

var properties = {
  '': {},
  'biotype' : { displayName: 'Biotype', type: 'distribution' },
  'id' : { displayName: 'ID', type: 'facet' },
  'map' : { displayName: 'Genome map', type: 'distribution' },
  'name' : { displayName: 'Name', type: 'facet' },
  'region' : { displayName: 'Genomic region', type: 'distribution' },
  'system_name' : { displayName: 'Species', type: 'distribution' },
  'taxon_id' : { displayName: 'Taxon ID', type: 'distribution' },
  'canonical_translation' : { displayName: 'Canonical translation', type: 'facet' },
  'canonical_translation_length' : { displayName: 'Canonical translation length', type: 'distribution' },
  'start' : { displayName: 'Start position', type: 'facet' },
  'strand' : { displayName: 'Strand', type: 'distribution' },
  'end' : { displayName: 'End position', type: 'facet' },
  'epl_gene_tree' : { displayName: 'Gene tree', type: 'distribution' },
  'epl_gene_tree_root_taxon_id' : { displayName: 'Gene tree root taxon', type: 'distribution' },
  'fixed_100_bin' : { type: 'distribution' },
  'fixed_200_bin' : { type: 'distribution' },
  'fixed_500_bin' : { type: 'distribution' },
  'fixed_1000_bin' : { type: 'distribution' },
  'uniform_1Mb_bin' : { type: 'distribution' },
  'uniform_2Mb_bin' : { type: 'distribution' },
  'uniform_5Mb_bin' : { type: 'distribution' },
  'uniform_10Mb_bin' : { type: 'distribution' }
};

var Other = React.createClass({
  getInitialState: function() {
    return {field: undefined, previousRt: undefined};
  },
  changeField: function() {
    this.setState({field: this.refs.chooser.getValue()});
  },
  componentWillUpdate: function(newProps: {[key:string]: any}, newState: {[key:string]: any}) {
    var rt, type;

    if(newState.field) {
      type = properties[newState.field].type;
      rt = resultTypes.get(type, {
        'facet.mincount': 1,
        'facet.field': newState.field,
        key: newState.field + '_for_other_analysis'
      });
    }

    if(rt && !_.isEqual(rt, this.state.previousRt)) {
      queryActions.removeResultType(newState.field + '_for_other_analysis');
      queryActions.setResultType(newState.field + '_for_other_analysis', rt);
      this.setState({previousRt: rt});
    }
  },
  componentWillUnmount: function() {
    queryActions.removeResultType(this.state.field + '_for_other_analysis');
  },
  render: function(): any {
    var selected = this.state.field,
        selectedDetails = properties[selected],
        data = this.props.search.results[selected + '_for_other_analysis'],
        options = _.map(properties, function(details, prop) {
          return (
            <option key={prop} value={prop}>{details.displayName || prop}</option>
          );
        }),
        chooser = (
          <bs.Input
            ref="chooser"
            type="select"
            label="Select property"
            placeholder="select"
            defaultValue={selected}
            onChange={this.changeField}>
            {options}
          </bs.Input>
        ),
        results;
    if(data) {
      results = (
        <div>
          {data.sorted.length} results for {selectedDetails.displayName}
        </div>
      );
    }
    return (
      <div className="filter">
        <div className="query">
          {chooser}
        </div>
        <h1>Histogram for {this.state.field}</h1>
        {results}
      </div>
    );
  }
});

module.exports = Other;