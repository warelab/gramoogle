import React from "react";
import ReactGA from "react-ga";
import _ from 'lodash';

const ResultDetailLink = ({
    detail,
    enabled,
    visibleDetail,
    hoverDetailCapability,
    onDetailSelect
}) => {
  const isActive = detail.name === _.get(visibleDetail, 'name');
  const simulateHover = hoverDetailCapability === detail.capability;

  const handler = () => {
    if(enabled) {
      // hide if already visible
      if (isActive) {
        onDetailSelect();
      }
      else {
        onDetailSelect(detail);
        ReactGA.event({
          category: 'Search',
          action: 'Details',
          label: detail.name
        });
      }
    }
  };
  const liClass = 'result-gene-detail-name' +
      (isActive ? ' active' : '') +
      (simulateHover ? ' hover' : '');
  const linkClass = enabled ? '' : 'disabled';

  return (
      <li onClick={handler} className={liClass}>
        <a className={linkClass} onClick={handler}>{detail.name}</a>
      </li>
  );
};

ResultDetailLink.propTypes = {
  detail: React.PropTypes.object.isRequired,
  enabled: React.PropTypes.bool.isRequired,
  visibleDetail: React.PropTypes.object,
  hoverDetailCapability: React.PropTypes.string,
  onDetailSelect: React.PropTypes.func.isRequired
};

export default ResultDetailLink;