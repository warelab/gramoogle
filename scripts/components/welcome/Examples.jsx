import React from "react";
import QueryActions from "../../actions/queryActions";

const exampleQueries = [
  {
    displayText: "What are the homologs of Arabidopsis thaliana's " +
    "PAD4 gene in the Oryzeae?",
    filters: {
      "gene_tree:EPlGT00140000001539": {
        "category": "Gene Tree",
        "fq": "gene_tree:EPlGT00140000001539",
        "id": "gene_tree:EPlGT00140000001539",
        "display_name": "Homolog of PAD4"
      },
      "taxonomy__ancestors:147380": {
        "weight": 594548,
        "fq": "taxonomy__ancestors:147380",
        "display_name": "Oryzeae",
        "id": "taxon_id:147380",
        "category": "Taxonomy",
        "score": 594548,
        "exclude": false
      }
    }
  },
  {
    displayText: "What cytosolic genes in A. thaliana and Z. mays " +
    "are in the pyruvate metabolism pathway and bind " +
    "either NAD or NADP?",
    filters: {
      "GO__ancestors:6090": {
        "display_name": "pyruvate metabolic process",
        "weight": 8641,
        "fq": "GO__ancestors:6090",
        "name": "pyruvate metabolic process",
        "id": "GO:0006090",
        "category": "GO process",
        "score": 8641,
        "exclude": false
      },
      "taxonomy__ancestors:4577": {
        "weight": 110301,
        "fq": "taxonomy__ancestors:4577",
        "display_name": "Zea mays",
        "id": "taxon_id:4577",
        "category": "Taxonomy",
        "score": 110301000,
        "exclude": false
      },
      "taxonomy__ancestors:3702": {
        "weight": 33602,
        "fq": "taxonomy__ancestors:3702",
        "display_name": "Arabidopsis thaliana",
        "id": "taxon_id:3702",
        "category": "Taxonomy",
        "score": 33602000,
        "exclude": false
      },
      "GO__ancestors:51287": {
        "weight": 2819,
        "fq": "GO__ancestors:51287",
        "display_name": "NAD binding",
        "id": "GO:0051287",
        "category": "GO function",
        "score": 2819,
        "exclude": false
      },
      "GO__ancestors:50661": {
        "weight": 2510,
        "fq": "GO__ancestors:50661",
        "display_name": "NADP binding",
        "id": "GO:0050661",
        "category": "GO function",
        "score": 2510,
        "exclude": false
      },
      "GO__ancestors:5829": {
        "weight": 19238,
        "fq": "GO__ancestors:5829",
        "display_name": "cytosol",
        "id": "GO:0005829",
        "category": "GO component",
        "score": 19238,
        "exclude": false
      }
    }
  }
];

const exampleToLi = onSelect => (egQ, idx) => {
  var resetFilters = function () {
    QueryActions.setAllFilters(egQ.filters);
    onSelect();
  };
  return (
      <li key={idx}><a onClick={resetFilters}>{egQ.displayText}</a></li>
  );
};

const Examples = ({onSelect}) => <div>
  <h3>For Example</h3>
  <p>You can use to ask sophisticated questions
    about the genes across all of our databases
    concerning crop and model plant genomes:</p>
  <ul>{exampleQueries.map(exampleToLi(onSelect))}</ul>
</div>;

Examples.propTypes = {
  onSelect: React.PropTypes.func.isRequired
};

export default Examples;