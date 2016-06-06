'use strict';

// import the styles (using lessify)
// require('../styles/main.less');

import React from 'react';
import ReactDOM from 'react-dom';

// Instantiate searchStore now so it's ready
// to listen to taxonomyActions.getTaxonomy
import './stores/searchStore';
import TaxonomyActions from './actions/taxonomyActions';

TaxonomyActions.getTaxonomy();
const App = React.createFactory(require('./components/app.jsx'));

ReactDOM.render(new App(), document.getElementById('content'));