import React from "react";
import {Detail, Title, Description, Content, Explore, Links} from "./generic/detail.jsx";
import TreeVis from "gramene-genetree-vis";
import queryActions from "../../../actions/queryActions";
import DocActions from "../../../actions/docActions";
import searchStore from "../../../stores/searchStore";
import _ from "lodash";
import treesClient from "gramene-trees-client";
import Spinner from "../../Spinner.jsx";
var ensemblURL = require('../../../../package.json').gramene.ensemblURL;

const processGenetreeDoc = treesClient.genetree.tree;

export default class Homology extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      taxonomy: searchStore.taxonomy,
      genomesOfInterest: _.get(searchStore, 'state.global.taxa')
    };
  }

  componentWillMount() {
    this.unsubscribeFromSearchStore = searchStore.listen((searchState) => {
      if (!_.isEqual(searchState.global.taxa, this.state.genomesOfInterest)) {
        return this.setState({
          genomesOfInterest: searchState.global.taxa,
        })
      }
    });

    this.orthologs = this.orthologList();
    this.paralogs = this.paralogList();
    this.treeId = _.get(this.props.gene, 'homology.gene_tree.id');

    if (this.treeId) {
      DocActions.needDocs('genetrees', this.treeId, processGenetreeDoc);
    }
  }

  componentWillUnmount() {
    this.unsubscribeFromSearchStore();
    DocActions.noLongerNeedDocs('genetrees', this.treeId);
  }

  componentWillUpdate(newProps) {
    this.genetree = _.get(newProps, ['docs', 'genetrees', this.treeId]);
  }

  orthologList() {
    return this.orthoParaList('ortholog');
  }

  paralogList() {
    return this.orthoParaList('within_species_paralog');
  }

  orthoParaList(type) {
    var homology, thisGeneId;
    homology = _.get(this.props.gene, 'homology.homologous_genes');
    thisGeneId = this.props.gene._id;

    if (homology) {
      var homologs = _(homology)
        .pickBy(function filterCategories(thing, name) {
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
  }

  createAllHomologsFilters() {
    var gt, fq, result;
    gt = this.treeId;
    fq = 'gene_tree:' + gt;
    result = {};
    result[fq] = {
      category: 'Gene Tree',
      fq: fq,
      id: fq,
      display_name: 'Homolog of ' + this.props.gene.name
    };
    return result;
  }

  createOrthologFilters() {
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
  }

  createParalogFilters() {
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
  }

  filterAllHomologs() {
    queryActions.setAllFilters(this.createAllHomologsFilters());
    if (this.props.closeModal) this.props.closeModal();
  }

  filterOrthologs() {
    queryActions.setAllFilters(this.createOrthologFilters());
    if (this.props.closeModal) this.props.closeModal();
  }

  filterParalogs() {
    queryActions.setAllFilters(this.createParalogFilters());
    if (this.props.closeModal) this.props.closeModal();
  }

  renderTreeVis() {
    if (this.genetree && this.state.taxonomy) {
      return (
        <div className="gene-genetree">
          <TreeVis genetree={this.genetree}
                   initialGeneOfInterest={this.props.gene}
                   genomesOfInterest={this.state.genomesOfInterest}
                   taxonomy={this.state.taxonomy}
                   allowGeneSelection={true}
                   pivotTree={true}
          />
        </div>
      );
    }
    else {
      return (
        <div className="gene-genetree">
          Loading <Spinner />
        </div>
      )
    }
  }

  explorations() {
    var tree, geneCount, explorations;

    if (this.treeId) {
      tree = _.get(this.props, ['docs', 'genetrees', this.treeId]);
    }

    if (tree) {
      geneCount = tree.geneCount;
    }

    explorations = [
      {
        name: 'Show All Homologs',
        handleClick: this.filterAllHomologs.bind(this),
        count: geneCount
      }
    ];

    if (this.orthologs) {
      explorations.push({
        name: "Show Orthologs",
        handleClick: this.filterOrthologs.bind(this),
        count: this.orthologs.length
      });
    }
    if (this.paralogs) {
      explorations.push({
        name: "Show Paralogs",
        handleClick: this.filterParalogs.bind(this),
        count: this.paralogs.length
      });
    }

    return explorations;
  }

  links() {
    var gene, ensemblGenetreeUrl;

    gene = this.props.gene;
    ensemblGenetreeUrl = `//${ensemblURL}/${gene.system_name}/Gene/Compara_Tree?g=${gene._id}`;

    return [
      {name: 'Ensembl Gene Tree view', url: ensemblGenetreeUrl}
    ];
  }

  render() {
    return (
      <Detail>
        <Title key="title">Compara Gene Tree</Title>
        <Description key="description">This phylogram shows the relationships between this genes and others similar to it, as determined
          by <a href="http://ensembl.org/info/genome/compara/index.html">Ensembl Compara</a>.</Description>
        <Content key="content">{this.renderTreeVis()}</Content>
        <Explore key="explore" explorations={this.explorations()}/>
        <Links key="links" links={this.links()}/>
      </Detail>
    );
  }
}

Homology.propTypes = {
  gene: React.PropTypes.object.isRequired,
  docs: React.PropTypes.object.isRequired,
  closeModal: React.PropTypes.func
};