var React = require('react');
var _ = require('lodash');

const ClosestOrtholog = ({gene, onClick, onMouseOver, onMouseOut}) =>
{
  let name, desc, species;
  
  if (gene.model_rep_id) {
    name = gene.model_rep_name || gene.model_rep_id;
    desc = gene.model_rep_description;
    species = gene.model_rep_species_name;
  }
  
  else if (gene.closest_rep_id) {
    name = gene.closest_rep_name || gene.closest_rep_id;
    desc = gene.closest_rep_description;
    species = gene.closest_rep_species_name;
  }

  return (
      <div className="closest-ortholog"
           onClick={onClick}
           onMouseOver={onMouseOver}
           onMouseOut={onMouseOut}>
        <h4>
          <span className="gene-id">{name}</span>
          <small className="species-name"> {species}</small>
        </h4>
        <p>{desc}</p>
      </div>
  );
};

ClosestOrtholog.propTypes = {
  gene: React.PropTypes.object.isRequired,
  onClick: React.PropTypes.func.isRequired,
  onMouseOver: React.PropTypes.func.isRequired,
  onMouseOut: React.PropTypes.func.isRequired
};

export default ClosestOrtholog;