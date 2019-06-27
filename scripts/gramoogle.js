// import the styles (using lessify)
// require('../styles/main.less');

import React from 'react';
import ReactDOM from 'react-dom';
import { Router, Route, browserHistory, IndexRoute } from 'react-router';
import ReactGA from 'react-ga';
import App from './components/app.jsx';
import Welcome from './components/welcome/WelcomePage.jsx';
import DrupalPage from './components/DrupalPage.jsx';
import Feedback from './components/Feedback.jsx';
import './stores/searchStore'; // Instantiate searchStore now so it's ready
import TaxonomyActions from './actions/taxonomyActions'; // to listen to taxonomyActions.getTaxonomy
import DrupalActions from './actions/drupalActions'; // and drupalActions.refreshBlogFeed

ReactGA.initialize('UA-1624628-5');
TaxonomyActions.getTaxonomy();
DrupalActions.refreshBlogFeed();

function logPageView() {
  ReactGA.set({ page: window.location.pathname });
  ReactGA.pageview(window.location.pathname);
}

ReactDOM.render((
  <Router history={browserHistory} onUpdate={logPageView} >
    <Route path="/" component={App}>
      <IndexRoute component={Welcome}/>
      <Route component={Welcome}>
        <Route path="feedback" component={Feedback}/>
        <Route path="node/:drupalNode" component={DrupalPage}/>
        <Route path=":drupalPath" component={DrupalPage}/>
      </Route>
    </Route>
  </Router>
), document.getElementById('content'));