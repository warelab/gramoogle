import React from 'react';
import EmbeddedDrupalPageLink from './EmbeddedDrupalPageLink.jsx';
import StaticSocialButtons from './StaticSocialButtons.jsx';
var grameneRelease = require('../../../package.json').gramene.dbRelease;


const Footer = () => {
  const releaseUrl = `/release-notes-${grameneRelease}`;
  const releaseLabel = `Release Notes (${grameneRelease})`;
  return (
    <nav className="submenu navbar navbar-default">
      <div className="container">
        <ul className="nav navbar-nav">
          <li>
            <EmbeddedDrupalPageLink text={releaseLabel} path={releaseUrl} />
          </li>
          <li>
            <EmbeddedDrupalPageLink text="About" path="/about-gramene" />
          </li>
          <li>
            <EmbeddedDrupalPageLink text="Cite" path="/cite" />
          </li>
          <li>
            <EmbeddedDrupalPageLink text="Feedback" path="/feedback" />
          </li>
        </ul>
        <StaticSocialButtons />
      </div>
    </nav>
  );
};

export default Footer;