import React from 'react';
import EmbeddedDrupalPageLink from './EmbeddedDrupalPageLink.jsx';
import StaticSocialButtons from './StaticSocialButtons.jsx';



const Footer = () => {
  const releaseUrl = `/release-notes-${window.gramene.grameneRelease}`;
  const releaseLabel = `Release Notes (${window.gramene.grameneRelease})`;
  return (
    <nav className="submenu navbar navbar-default">
      <div className="container">
        <ul className="nav navbar-nav">
          <li>
            <EmbeddedDrupalPageLink text={releaseLabel} path={releaseUrl} />
          </li>
          <li><a href="//gramene.org/contact">Contact</a></li>
          <li>
            <EmbeddedDrupalPageLink text="About" path="/about-gramene" />
          </li>
          <li>
            <EmbeddedDrupalPageLink text="Cite" path="/cite" />
          </li>
          <li><a href="//tools.gramene.org/feedback">Feedback</a></li>
        </ul>
        <StaticSocialButtons />
      </div>
    </nav>
  );
};

export default Footer;