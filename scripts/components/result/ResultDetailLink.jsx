import React from "react";

const ResultDetailLink = ({
    detail,
    enabled,
    visibleDetailName,
    hoverDetailCapability,
    onDetailSelect
}) => {

  const isActive = detail.name === visibleDetailName;
  const simulateHover = hoverDetailCapability === detail.capability;

  const handler = () => {
    if(enabled) {
      // hide if already visible
      if (isActive) {
        onDetailSelect();
      }
      else {
        onDetailSelect(detail);
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
  visibleDetailName: React.PropTypes.string,
  hoverDetailCapability: React.PropTypes.string,
  onDetailSelect: React.PropTypes.func.isRequired
};

export default ResultDetailLink;