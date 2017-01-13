import React from 'react';

import StaticSocialButtons from './StaticSocialButtons.jsx';
import EmbeddedDrupalPageLink from './EmbeddedDrupalPageLink.jsx';

export default class Footer extends React.Component {
  render() {
    const releaseUrl = `//gramene.org/release-notes-${window.gramene.grameneRelease}`;
    return (
      <nav className="submenu navbar navbar-default">
        <div className="container">
          <ul className="nav navbar-nav">
            <li><a href={releaseUrl}>
              Release Notes
            </a></li>
            <li><a href="//gramene.org/contact">Contact</a></li>
            <li><a href="//gramene.org/about-gramene">About</a></li>
            <li>
              <EmbeddedDrupalPageLink text="Cite"
                                      jsonUrl="http://gramene.org/rest/node/214.json" />
            </li>
            <li><a href="//tools.gramene.org/feedback">Feedback</a></li>
          </ul>
          <StaticSocialButtons />
        </div>
      </nav>
    );
  }
}