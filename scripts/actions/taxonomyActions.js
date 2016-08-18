import Reflux from "reflux";
import {promise as taxonomyPromise} from "gramene-trees-client";
import _ from "lodash";

const TaxonomyAction = Reflux.createActions({
  'getTaxonomy': {asyncResult: true}
});

TaxonomyAction.getTaxonomy.listen(function () {
  taxonomyPromise.get()
                 .then((taxonomy) => {
                   console.log('got taxonomy when action called', taxonomy);
                   return {
                     taxonomy,
                     taxonIdToSpeciesName: _.mapValues(taxonomy.indices.id, 'model.name')
                   }
                 })
                 .then((obj) => {
                   console.log('taxonomy object', obj);
                   return obj
                 })
                 .then(this.completed)
                 .catch(this.failed);
});

export default TaxonomyAction;