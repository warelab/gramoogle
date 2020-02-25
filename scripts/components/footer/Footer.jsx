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
            <a href="http://www.gramene.org">Gramene main site</a>
          </li>
          <li>
            <EmbeddedDrupalPageLink text="Feedback" path="/feedback" />
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