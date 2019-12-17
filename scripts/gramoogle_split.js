// import the styles (using lessify)
// require('../styles/main.less');

import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, browserHistory, IndexRoute } from 'react-router';
import Header from './components/header.jsx';
import Results from './components/results/results.jsx';
import './stores/searchStore'; // Instantiate searchStore now so it's ready
import TaxonomyActions from './actions/taxonomyActions'; // to listen to taxonomyActions.getTaxonomy

TaxonomyActions.getTaxonomy();

ReactDOM.render((<Header noLogo={true}/>), document.getElementById('gramoogle_header'));
ReactDOM.render((<Results />), document.getElementById('gramoogle_results'));

