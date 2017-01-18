import React from 'react';
import DrupalActions from '../../actions/drupalActions';
import QueryActions from '../../actions/queryActions';

const EmbeddedDrupalPageLink = ({text, path, onClick}) =>
  <a href="javascript:void(0)" onClick={() => {
    QueryActions.removeAllFilters();
    DrupalActions.fetchDrupalPage(path)
  }}>{text}</a>;

EmbeddedDrupalPageLink.propTypes = {
  text: React.PropTypes.string.isRequired,
  path: React.PropTypes.string.isRequired
};

export default EmbeddedDrupalPageLink;