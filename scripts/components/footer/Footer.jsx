import React from 'react';
import EmbeddedDrupalPageLink from './EmbeddedDrupalPageLink.jsx';
import StaticSocialButtons from './StaticSocialButtons.jsx';
import ReactGA from "react-ga";
import QueryActions from "../../actions/queryActions";
import {browserHistory} from "react-router";
var grameneRelease = require('../../../package.json').gramene.dbRelease;

function externalLink(path) {
  return {
    onClick: () => {
      ReactGA.outboundLink({
        label: path
      }, function () {
        window.location.href = path;
      });
    },
    href: "javascript:void(0);"
  }
}
const Footer = ({noSocial}) => {
  const releaseUrl = `/release-notes-${grameneRelease}`;
  const releaseLabel = `Release Notes (${grameneRelease})`;
  const socialMaybe = noSocial ? undefined : <StaticSocialButtons />;
  return (
    <nav className="submenu navbar navbar-default">
      <div className="container">
        <ul className="nav navbar-nav">
          <li>
            <a href="http://www.gramene.org">Gramene main site</a>
          </li>
          {/*<li>*/}
            {/*<EmbeddedDrupalPageLink text={releaseLabel} path={releaseUrl} />*/}
          {/*</li>*/}
          {/*<li>*/}
            {/*<EmbeddedDrupalPageLink text="About" path="/about-gramene" />*/}
          {/*</li>*/}
          {/*<li>*/}
            {/*<EmbeddedDrupalPageLink text="Cite" path="/cite" />*/}
          {/*</li>*/}
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