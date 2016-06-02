import React from 'react';

import ClosestOrtholog from "./closestOrtholog.jsx";

const ResultBody = (props) =>
    <div className="result-gene-summary">
      <div className="result-gene-title-body">
           {renderTitle(props)}
           {renderBody(props)}
      </div>
         {renderMetadata(props)}
    </div>
    ;

function renderMetadata(props) {
  return renderTairSummary(props)
      || renderClosestOrtholog(props);
}

function renderTitle ({searchResult, speciesName}) {
  let species, geneId;

  if (speciesName) {
    species = <span className="species-name">{speciesName}</span>;
  }
  if (searchResult.id !== searchResult.name) {
    geneId = <span className="gene-id">{searchResult.id}</span>;
  }

  return (
      <h3 className="gene-title">
        <span className="gene-name">{searchResult.name} </span>
        <wbr/>
        <small className="gene-subtitle">{geneId} </small>
        <small className="gene-species">{species}</small>
      </h3>
  );
}

function renderBody ({searchResult}) {
  return (
      <p className="gene-description">{searchResult.description}</p>
  );
}

function renderTairSummary ({searchResult}) {
  var summary, text, onClick;

  summary = searchResult.summary;
  if (!summary) {
    return;
  }

  onClick = function () {};
  text = summary;

  if (summary.length > 160) {
    text = summary.substr(0, 150) + '…';
  }

  return (
      <div className="gene-summary-tair">
        <p>{text}</p>
      </div>
  )
}

function renderClosestOrtholog ({
    searchResult,
    visibleDetail,
    hoverHomologyTab,
    unhoverHomologyTab,
    selectHomologyTab
}) {
  const homologyDetailsVisible = _.get(visibleDetail, 'name') === 'Homology';

  if (shouldShowClosestOrtholog(searchResult)) {

    // we used to not add the closest ortholog to the DOM if the homology detail was visible.
    // however, that could cause the height of the result to change. Instead we set visibility:hidden
    // so that the renderer takes into account the height of the ortholog even if not shown.
    return (
        <ClosestOrtholog gene={searchResult}
                         onMouseOver={hoverHomologyTab}
                         onMouseOut={unhoverHomologyTab}
                         onClick={selectHomologyTab}
                         hidden={homologyDetailsVisible}/>
    );
  }
}

// show closest ortholog prominently if we have data to show:-
//   a. either there's a closest ortholog (determined by traversing the gene tree until an id or description looks
// curated) b. or there's a model ortholog (traverse tree to find an ortholog in arabidopsis)
function shouldShowClosestOrtholog(searchResult) {
  return (
      searchResult.closest_rep_id || (
          searchResult.model_rep_id &&
          searchResult.model_rep_id !== searchResult.id
      )
  );
}

ResultBody.propTypes = {
  searchResult: React.PropTypes.object.isRequired,
  visibleDetail: React.PropTypes.object,
  speciesName: React.PropTypes.string,

  hoverHomologyTab: React.PropTypes.func.isRequired,
  unhoverHomologyTab: React.PropTypes.func.isRequired,
  selectHomologyTab: React.PropTypes.func.isRequired
};

export default ResultBody;