import React from "react";
import _ from "lodash";
import ResultDetailLink from './ResultDetailLink.jsx';

const ResultDetails = (props) => <div className="result-content">
        <ul className="result-links">
            {renderDetailLinks(props)}
        </ul>
           {renderVisibleDetailElement(props)}
      </div>;


function renderVisibleDetailElement({visibleDetail, geneDoc, docs}) {
  if(visibleDetail) {
    const visibleDetailComponent = visibleDetail.reactClass;
    return (
        <div className="visible-detail">
             {React.createElement(visibleDetailComponent, {gene: geneDoc, docs})}
        </div>
    )
  }
};

function renderDetailLinks(props) {

  return _.map(props.details, (resultDetail, key) =>
      <ResultDetailLink key={key}
                        detail={resultDetail}
                        {...props} />);
}

ResultDetails.propTypes = {
  details: React.PropTypes.array.isRequired,
  enabled: React.PropTypes.bool.isRequired,
  visibleDetail: React.PropTypes.object,
  hoverDetailCapability: React.PropTypes.string,
  onDetailSelect: React.PropTypes.func.isRequired,
  geneDoc: React.PropTypes.object,
  docs: React.PropTypes.object
};

export default ResultDetails;