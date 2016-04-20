export default function stats(selection, taxonomy) {
  const selectedResults = selection.reduce((acc, bin)=>acc + bin.results.count);
  const selectedGenes = selections.reduce((acc, bin)=>acc + bin.stats.count);
  const totalResults = taxonomy.model.results.count;
  const selectedBins = Object.keys(selection).length;

  return {
    totalResults: selectedResults,
    selectedGenes: selectedGenes,
    numSelectedBins: selectedBins,
    proportion: selectedResults / totalResults
  }
}