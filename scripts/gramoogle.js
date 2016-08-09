// import the styles (using lessify)
// require('../styles/main.less');

import React from 'react';
import ReactDOM from 'react-dom';

// Instantiate searchStore now so it's ready
// to listen to taxonomyActions.getTaxonomy
import './stores/searchStore';
import TaxonomyActions from './actions/taxonomyActions';
import WelcomeActions from './actions/welcomeActions';

import App from './components/app.jsx';

TaxonomyActions.getTaxonomy();
WelcomeActions.refreshBlogFeed();

const AppFactory = React.createFactory(App);
const app = new AppFactory({context: 'client'});

ReactDOM.render(app, document.getElementById('content'));