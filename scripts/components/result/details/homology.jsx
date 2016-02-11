'use strict';

var React = require('react');
var Reflux = require('reflux');

var TreeVis = require('gramene-genetree-vis');

var queryActions = require('../../../actions/queryActions');
var DocActions = require('../../../actions/docActions');
var lutStore = require('../../../stores/lutStore');

var _ = require('lodash');

var processGenetreeDoc = require('gramene-trees-client').genetree.tree;

var QueryTerm = require('../queryTerm.jsx');

var Homology = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    docs: React.PropTypes.object.isRequired
  },

  mixins: [
    Reflux.connect(lutStore, 'luts')
  ],

  getInitialState: function () {
    return {
      luts: lutStore.state
    };
  },

  componentWillMount: function () {
    this.orthologs = this.orthologList();
    this.paralogs = this.paralogList();
    this.treeId = this.props.gene.grm_gene_tree;

    if (this.treeId) {
      DocActions.needDocs('genetrees', this.treeId, processGenetreeDoc);
    }
    //
    //this.genetree = this.props.docs.genetrees[this.props.gene.grm_gene_tree];
  },

  componentWillUpdate: function (newProps, newState) {
    var genetreeId, genetree, taxonomy;

    genetreeId = this.props.gene.grm_gene_tree;
    this.genetree = _.get(newProps, ['docs', 'genetrees', genetreeId]);
    this.taxonomy = _.get(newState, ['luts', 'taxonomy']);
  },

  componentWillUnmount: function () {
    DocActions.noLongerNeedDocs('genetrees', this.treeId);
  },

  orthologList: function () {
    return this.orthoParaList('ortholog');
  },

  paralogList: function () {
    return this.orthoParaList('within_species_paralog');
  },

  orthoParaList: function orthoParaList(type) {
    var homology, thisGeneId;
    homology = this.props.gene.homology;
    thisGeneId = this.props.gene._id;

    if (homology) {
      var homologs = _(homology)
        .pick(function filterCategories(thing, name) {
          return name.indexOf(type) === 0;
        })
        .values()
        .flatten()
        .value();

      if (!_.isEmpty(homologs)) {
        homologs.push(thisGeneId);
        return homologs; // only return something if we have something. We're testing for truthiness later.
      }
    }
  },

  createAllHomologsFilters: function () {
    var gt, fq, result;
    gt = this.props.gene.grm_gene_tree;
    fq = 'grm_gene_tree:' + gt;
    result = {};
    result[fq] = {
      category: 'Gene Tree',
      fq: fq,
      id: fq,
      display_name: 'Homolog of ' + this.props.gene.name
    };
    return result;
  },

  createOrthologFilters: function () {
    var fq, id, result;
    id = this.props.gene._id;
    fq = 'homology__ortholog_one2one:' + id +
      ' OR homology__ortholog_one2many:' + id +
      ' OR homology__ortholog_many2many:' + id +
      ' OR id:' + id;
    result = {};
    result[fq] = {
      category: 'Gene Tree',
      id: fq,
      fq: fq,
      display_name: 'Orthologs of ' + this.props.gene.name
    };
    return result;
  },

  createParalogFilters: function () {
    var fq, id, result;
    id = this.props.gene._id;
    fq = 'homology__within_species_paralog:' + id +
      ' OR id:' + id;
    result = {};
    result[fq] = {
      category: 'Gene Tree',
      id: fq,
      fq: fq,
      display_name: 'Paralogs of ' + this.props.gene.name
    };
    return result;
  },

  filterAllHomologs: function () {
    queryActions.setAllFilters(this.createAllHomologsFilters());
  },

  filterOrthologs: function () {
    queryActions.setAllFilters(this.createOrthologFilters());
  },

  filterParalogs: function () {
    queryActions.setAllFilters(this.createParalogFilters());
  },

  treeVis: function () {
    if (this.genetree && this.taxonomy) {
      return (
        <TreeVis genetree={this.genetree}
                 initialGeneOfInterest={this.props.gene}
                 taxonomy={this.taxonomy}
                 width={600}/>
      );
    }
  },

  render: function () {
    var tree, gene, geneCount, ensemblGenetreeUrl;

    gene = this.props.gene;

    if (this.treeId) {
      tree = _.get(this.props, ['docs', 'genetrees', this.treeId]);
    }

    if (tree) {
      geneCount = tree.geneCount;
    }

    ensemblGenetreeUrl = '//ensembl.gramene.org/' + gene.system_name + '/Gene/Compara_Tree?g=' + gene._id;

    var filters = [
      <QueryTerm key="all"
                 name="Show All Homologs"
                 count={geneCount}
                 handleClick={this.filterAllHomologs}/>
    ];
    if (this.orthologs) {
      filters.push(<QueryTerm key="ortho"
                              name="Show Orthologs"
                              count={this.orthologs.length}
                              handleClick={this.filterOrthologs}/>)
    }
    if (this.paralogs) {
      filters.push(<QueryTerm key="para"
                              name="Show Paralogs"
                              count={this.paralogs.length}
                              handleClick={this.filterParalogs}/>)
    }

    return (
      <div>
        <h5>Change the query</h5>
        {filters}
        {this.treeVis()}
        <h5>Links</h5>
        <ul>
          <li>
            <a href={ensemblGenetreeUrl}>Ensembl Gene Tree view</a>
          </li>
        </ul>
      </div>
    );
  }
});
module.exports = Homology;