import _ from "lodash";

export default function stats(selections, taxonomy) {
  const selectionData = getSelectionData(selections, taxonomy);
  const totalGeneResults = taxonomy.model.results.count;
  const fq = fqFromSelections(selections);

  return {
    selectedGenes: selectionData.resultsCount,
    totalGeneResults,
    fq,
    numSelectedBins: selectionData.binsCount,
    proportionGenesSelected: selectionData.resultsCount / totalGeneResults
  }
}

function getSelectionData(selection, taxonomy) {
  return _.reduce(selection, (countAcc, sel) => {
    const bins = taxonomy.getBins(sel.binFrom.idx, sel.binTo.idx);
    countAcc.binsCount += bins.length;
    countAcc.resultsCount += _.reduce(bins, (acc, bin) => acc + bin.results.count, 0);
    return countAcc;
  }, {resultsCount: 0, binsCount: 0});
}

const selectionToSolrRange = (sel)=>`[${sel.binFrom.idx} TO ${sel.binTo.idx}]`;

function fqFromSelections(selections) {
  const rangeStrings = selections.map(selectionToSolrRange);
  return `fixed_1000__bin:(${rangeStrings.join(' ')})`;
}