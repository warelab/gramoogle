'use strict';

import Location from './location.jsx';
import Homology from './homology.jsx';
import Xrefs from './xrefs.jsx';

const inventory = [

  {
    name: 'Location',
    capability: 'location',
    reactClass: Location
  },

  //
  // {
  //   name: 'Transcript', // for display
  //   capability: 'domains',
  //   reactClass: require('./domains.jsx')
  // },
  //
  {
    name: 'Homology',
    capability: 'homology',
    reactClass: Homology
  },
  
  // {
  //   name: 'Pathways', // for display
  //   capability: 'pathways',
  //   reactClass: require('./pathways.jsx')
  // },

  {
    name: 'X-refs',
    capability: 'xrefs',
    reactClass: Xrefs
  }

];

export default inventory;