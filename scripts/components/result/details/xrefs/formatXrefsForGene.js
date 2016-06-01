import React from 'react';
import _ from 'lodash';
import dbxrefs from 'gramene-dbxrefs';

import Xref from './Xref.jsx';

export default function formatXrefsForGene(gene) {
  if(!gene || !_.isArray(gene.xrefs)) {
    throw new Error("No xrefs for " + _.get(gene._id));
  }
  return _(gene.xrefs)
    .keyBy('db')
    .pickBy(function(val, name) {
      return dbxrefs.isKnown(name);
    })
    .map(function(val, name) {
      var xref = dbxrefs.fetch(name);
      return {url: xref.url, label: xref.label, val: val.ids};
    })
    .groupBy('label')
    .map(function(members, displayName) {
      return (
        <Xref key={displayName} displayName={displayName} members={members} />
      )
    })
    .value();
};