import React from 'react';
import EmbeddedDrupalPageLink from './EmbeddedDrupalPageLink.jsx';
import StaticSocialButtons from './StaticSocialButtons.jsx';
var grameneRelease = require('../../../package.json').gramene.dbRelease;


const Footer = ({noSocial}) => {
  const releaseUrl = `/release-notes-${grameneRelease}`;
  const releaseLabel = `Release Notes (${grameneRelease})`;
  const socialMaybe = noSocial ? undefined : <StaticSocialButtons />;
  return (
    <nav className="submenu navbar navbar-default" id="search-footer">
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
          <li>
            <EmbeddedDrupalPageLink text="Privacy" path="/personal-data-privacy" />
          </li>
        </ul>
        {socialMaybe}
      </div>
    </nav>
  );
};

Footer.propTypes = {
  noSocial: React.PropTypes.bool
};

export default Footer;