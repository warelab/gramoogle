import React from 'react';
import DrupalActions from '../../actions/drupalActions';


const EmbeddedDrupalPageLink = ({text, jsonUrl, onClick}) =>
  <a href="javascript:void(0)" onClick={() => DrupalActions.fetchDrupalPage(jsonUrl)}>{text}</a>;

EmbeddedDrupalPageLink.propTypes = {
  text: React.PropTypes.string.isRequired,
  jsonUrl: React.PropTypes.string.isRequired
};

export default EmbeddedDrupalPageLink;