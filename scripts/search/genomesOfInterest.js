import _ from "lodash";

const speciesSets = require('../../package.json').gramene.taxa;

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