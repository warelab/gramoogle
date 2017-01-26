// import the styles (using lessify)
// require('../styles/main.less');

import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, browserHistory, IndexRoute } from 'react-router';

// Instantiate searchStore now so it's ready
// to listen to taxonomyActions.getTaxonomy
import './stores/searchStore';
import TaxonomyActions from './actions/taxonomyActions';
import DrupalActions from './actions/drupalActions';

import App from './components/app.jsx';
import Welcome from './components/welcome/WelcomePage.jsx';
import DrupalPage from './components/DrupalPage.jsx';

TaxonomyActions.getTaxonomy();
DrupalActions.refreshBlogFeed();

// const AppFactory = React.createFactory(App);
// const app = new AppFactory({context: 'client'});

ReactDOM.render((
  <Router history={browserHistory}>
    <Route path="/" component={App}>
      <IndexRoute component={Welcome}/>
      <Route path="/:drupalPath" component={DrupalPage}/>
      <Route path="/node/:drupalNode" component={DrupalPage}/>
    </Route>
  </Router>
), document.getElementById('content'));