'use strict';

module.exports = {
  Species: {
    name: 'Species', // for display
    field: 'species', // field in the tally result type
    queryField: 'NCBITaxon_ancestors', // field used as a query parameter
    reactClass: require('./species.jsx') // view component class
  },
  Homologs: {
    name: 'Homologs',
    field: 'grm_gene_tree',
    queryField: 'grm_gene_tree',
    reactClass: require('./gene_tree.jsx')
  },
  Domain: {
    name: 'Domain',
    field: 'domains',
    queryField: 'domainRoot',
    reactClass: require('./domain.jsx')
  },
  GO: {
    name: 'GO',
    field: 'GO',
    queryField: 'GO_xrefi',
    reactClass: require('./go.jsx')
  },
  PO: {
    name: 'PO',
    field: 'PO',
    queryField: 'PO_xrefi',
    reactClass: require('./po.jsx')
  },
  Biotype: {
    name: 'Biotype',
    field: 'biotype',
    queryField: 'biotype',
    reactClass: require('./biotype.jsx')
  },
  Other: {
    name: 'Other',
    reactClass: require('./other.jsx')
  }
};