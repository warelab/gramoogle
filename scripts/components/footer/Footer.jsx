import React from 'react';

import StaticSocialButtons from './StaticSocialButtons.jsx';
import EmbeddedDrupalPageLink from './EmbeddedDrupalPageLink.jsx';

const Footer = () => {
  const releaseUrl = `//data.gramene.org/drupal/release-notes-${window.gramene.grameneRelease}`;
  const releaseLabel = `Release Notes (${window.gramene.grameneRelease})`;
  return (
    <nav className="submenu navbar navbar-default">
      <div className="container">
        <ul className="nav navbar-nav">
          <li>
            <EmbeddedDrupalPageLink text={releaseLabel}
                                    jsonUrl={releaseUrl} />
          </li>
          <li><a href="//gramene.org/contact">Contact</a></li>
          <li>
            <EmbeddedDrupalPageLink text="About" jsonUrl="http://data.gramene.org/drupal/about-gramene"/>
          </li>
          <li>
            <EmbeddedDrupalPageLink text="Cite"
                                    jsonUrl="http://data.gramene.org/drupal/cite" />
          </li>
          <li><a href="//tools.gramene.org/feedback">Feedback</a></li>
        </ul>
        <StaticSocialButtons />
      </div>
    </nav>
  );
};

export default Footer;