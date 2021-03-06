import React from "react";
import ReactGA from "react-ga";
import {Glyphicon} from "react-bootstrap";
import ClosestOrtholog from "./closestOrtholog.jsx";

var ensemblURL = require('../../../package.json').gramene.ensemblURL;

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

function renderTitle({searchResult}) {
  let species, geneId, synonyms;
  let external = <small title="This link opens a page from an external site"> <Glyphicon glyph="new-window" /></small>;

  if (searchResult.species_name) {
    species = <span className="species-name">{searchResult.species_name}</span>;
  }
  if (searchResult.id !== searchResult.name) {
    geneId = <span className="gene-id">{searchResult.id}</span>;
  }
  if (searchResult.synonyms) {
    // synonyms = searchResult.synonyms.filter(syn => syn !== searchResult.description).join(' ');
    synonyms = searchResult.synonyms.filter(syn => /^GRMZM/.test(syn)).join(' ');
  }
  return (
      <h3 className="gene-title">
        <span className="gene-name">{searchResult.name} </span>
        <wbr/>
        <small className="gene-id">{geneId} </small>
        <small className="gene-synonyms">{synonyms}</small>
        <small className="gene-species">
          <ReactGA.OutboundLink
            eventLabel={searchResult.system_name}
            to={`//${ensemblURL}/${searchResult.system_name}/Info/Index`}
            className="external-link"
          >
            {species}{external}
          </ReactGA.OutboundLink>
        </small>
      </h3>
  );
}

function renderBody({searchResult}) {
  return (
      <p className="gene-description">{searchResult.description}</p>
  );
}

function renderTairSummary({searchResult}) {
  const summary = searchResult.summary;
  if(summary && searchResult.taxon_id === 3702) {
    return (
        <div className="gene-summary-tair">
          {trimSummary(summary)}
        </div>
    )
  }
}

function trimSummary(summary) {
  if(summary.length > 160) {
    const start = summary.substr(0, 150);
    const rest = summary.substr(150);
    return <p>{start}<span className="ellipsis">…</span><span className="rest">{rest}</span></p>
  }
  else {
    return <p>{summary}</p>
  }
}

function renderClosestOrtholog({
    searchResult,
    hoverHomologyTab,
    unhoverHomologyTab,
    selectHomologyTab
}) {

  if (shouldShowClosestOrtholog(searchResult)) {

    // we used to not add the closest ortholog to the DOM if the homology detail was visible.
    // however, that could cause the height of the result to change. Instead we set visibility:hidden
    // so that the renderer takes into account the height of the ortholog even if not shown.
    return (
        <ClosestOrtholog gene={searchResult}
                         onMouseOver={hoverHomologyTab}
                         onMouseOut={unhoverHomologyTab}
                         onClick={selectHomologyTab}/>
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
  speciesName: React.PropTypes.string,

  hoverHomologyTab: React.PropTypes.func.isRequired,
  unhoverHomologyTab: React.PropTypes.func.isRequired,
  selectHomologyTab: React.PropTypes.func.isRequired
};

export default ResultBody;