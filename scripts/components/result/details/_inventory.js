'use strict';

module.exports = [

  {
    name: 'Structure & Location',
    capability: 'location',
    reactClass: require('./geneStructure.jsx')
  },

  {
    name: 'Homology',
    capability: 'homology',
    reactClass: require('./homology.jsx')
  },

  {
    name: 'Transcript Features', // for display
    capability: 'domains',
    reactClass: require('./domains.jsx')
  },

  {
    name: 'Pathways', // for display
    capability: 'pathways',
    reactClass: require('./pathways.jsx')
  },

  {
    name: 'Cross-references',
    capability: 'xrefs',
    reactClass: require('./xrefs.jsx')
  }

];