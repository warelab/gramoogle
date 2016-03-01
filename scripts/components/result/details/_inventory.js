'use strict';

module.exports = [

  {
    name: 'Location',
    capability: 'location',
    reactClass: require('./location.jsx')
  },

  {
    name: 'Transcript', // for display
    capability: 'domains',
    reactClass: require('./domains.jsx')
  },

  {
    name: 'Homology',
    capability: 'homology',
    reactClass: require('./homology.jsx')
  },

  {
    name: 'Pathways', // for display
    capability: 'pathways',
    reactClass: require('./pathways.jsx')
  },

  {
    name: 'X-refs',
    capability: 'xrefs',
    reactClass: require('./xrefs.jsx')
  }

];