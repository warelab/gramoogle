import React from 'react';
import { browserHistory } from 'react-router';
import QueryActions from '../../actions/queryActions';

const EmbeddedDrupalPageLink = ({text, path, onClick}) =>
  <a href="javascript:void(0)" onClick={() => {
    QueryActions.removeAllFilters();
    browserHistory.push(path);
  }}>{text}</a>;

EmbeddedDrupalPageLink.propTypes = {
  text: React.PropTypes.string.isRequired,
  path: React.PropTypes.string.isRequired
};

export default EmbeddedDrupalPageLink;