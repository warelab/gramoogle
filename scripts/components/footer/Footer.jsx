import React from 'react';
import { Link } from 'react-router';

import StaticSocialButtons from './StaticSocialButtons.jsx';

const Footer = () => {
  const releaseUrl = `/release-notes-${window.gramene.grameneRelease}`;
  const releaseLabel = `Release Notes (${window.gramene.grameneRelease})`;
  return (
    <nav className="submenu navbar navbar-default">
      <div className="container">
        <ul className="nav navbar-nav">
          <li>
            <Link to={releaseUrl}>{releaseLabel}</Link>
          </li>
          <li><a href="//gramene.org/contact">Contact</a></li>
          <li>
            <Link to="/about-gramene">About</Link>
          </li>
          <li>
            <Link to="/cite">Cite</Link>
          </li>
          <li><a href="//tools.gramene.org/feedback">Feedback</a></li>
        </ul>
        <StaticSocialButtons />
      </div>
    </nav>
  );
};

export default Footer;