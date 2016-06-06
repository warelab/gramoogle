'use strict';

// import the styles (using lessify)
// require('../styles/main.less');

import React from 'react';
import ReactDOM from 'react-dom';

// Instantiate searchStore now so it's ready
// to listen to taxonomyActions.getTaxonomy
// import './stores/searchStore';
import TaxonomyActions from './actions/taxonomyActions';
import WelcomeActions from './actions/welcomeActions';

TaxonomyActions.getTaxonomy();
WelcomeActions.refreshBlogFeed();
const App = React.createFactory(require('./components/app.jsx'));

ReactDOM.render(new App({context: 'client'}), document.getElementById('content'));