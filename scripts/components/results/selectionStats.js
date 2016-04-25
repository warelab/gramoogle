import _ from 'lodash';

export default function stats(selection, taxonomy) {
  const selectedResults = _.reduce(selection, (acc, bin)=>acc + bin.results.count, 0);
  const totalResults = taxonomy.model.results.count;
  const selectedBins = Object.keys(selection).length;

  return {
    selectedGenes: selectedResults,
    totalGeneResults: totalResults,
    numSelectedBins: selectedBins,
    proportionGenesSelected: selectedResults / totalResults
  }
}