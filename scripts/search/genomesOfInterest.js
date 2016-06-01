import _ from "lodash";

const speciesSets = {
  default: {}
  // default: {3702: true, 4577: true, 39947: true, 15368: true, 3847: true}
};

export function matchesNamedSpeciesSet(setName, selection) {
  const referenceSet = speciesSets[setName];
  if(!referenceSet) {
    throw new Error(`Reference set named ${setName} does not exist`);
  }
  return _.size(selection) === _.size(referenceSet)
      && _.every(referenceSet, (val, taxonId) => !!selection[taxonId])
}

export function getNamedSpeciesSet(selection) {
  return _.clone(speciesSets[selection]);
}