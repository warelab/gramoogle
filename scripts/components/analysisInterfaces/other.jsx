'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var queryActions = require('../../actions/queryActions');
var resultTypes = require('gramene-search-client').resultTypes;

var properties = [
  undefined,
  'biotype',
  //'id', // TODO these can be faceted, or distributioned if >1000 results
  'map',
  //'name',
  'region',
  'species',
  'system_name',
  'taxon_id',
  //'canonical_translation',
  'canonical_translation_length',
  //'start',
  'strand',
  //'end',
  'epl_gene_tree',
  'epl_gene_tree_root_taxon_id',
  'fixed_100_bin',
  'fixed_200_bin',
  'fixed_500_bin',
  'fixed_1000_bin',
  'uniform_1Mb_bin',
  'uniform_2Mb_bin',
  'uniform_5Mb_bin',
  'uniform_10Mb_bin'
];

var Other = React.createClass({
  getInitialState: function() {
    return {field: undefined};
  },
  changeField: function() {
    this.setState({field: this.refs.chooser.getValue()});
  },
  componentWillUpdate: function(newProps, newState) {
    var newRt;
    if(newState.field !== this.state.field) {
      newRt = resultTypes.get('distribution', {
        'facet.field': newState.field,
        key: newState.field + '_for_other_analysis'
      });

      queryActions.removeResultType(this.state.field + '_for_other_analysis');
      queryActions.setResultType(newState.field + '_for_other_analysis', newRt);
    }
  },
  componentWillUnmount: function() {
    queryActions.removeResultType(this.state.field + '_for_other_analysis');
  },
  render: function() {
    var selected = this.state.field,
        data = this.props.search.results[selected + '_for_other_analysis'],
        options = properties.map(function(prop, idx) {
          return (
            <option key={idx} value={prop}>{prop}</option>
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
          {data.sorted.length} results for {selected}
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