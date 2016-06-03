import Reflux from "reflux";
import {promise as taxonomyPromise} from "gramene-trees-client";

const TaxonomyAction = Reflux.createActions({
  'getTaxonomy': {asyncResult: true}
});

TaxonomyAction.getTaxonomy.listen(function () {
  taxonomyPromise.get()
                 .then((taxonomy) => ({
                   taxonomy,
                   taxonIdToSpeciesName: _.mapValues(taxonomy.indices.id, 'model.name')
                 }))
                 .then(this.completed)
                 .catch(this.failed);
});

export default TaxonomyAction;