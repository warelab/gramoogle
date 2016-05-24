import _ from "lodash";

export default function stats(selection, taxonomy) {
  const selectionData = getSelectionData(selection, taxonomy);
  const totalGeneResults = taxonomy.model.results.count;
  const binIdxn = selectionData.bins.map((bin)=>bin.idx);
  const fq = `fixed_1000__bin:(${binIdxn.join(' ')})`;

  return {
    selectedGenes: selectionData.resultsCount,
    totalGeneResults,
    fq,
    numSelectedBins: selectionData.bins.length,
    proportionGenesSelected: selectionData.resultsCount / totalGeneResults
  }
}

function getSelectionData(selection, taxonomy) {
  return _.reduce(selection, (countAcc, sel) => {
    const bins = taxonomy.getBins(sel.binFrom.idx, sel.binTo.idx);
    countAcc.bins.push(...bins);
    countAcc.resultsCount += _.reduce(bins, (acc, bin) => acc + bin.results.count, 0);
    return countAcc;
  }, {bins: [], resultsCount: 0});
}