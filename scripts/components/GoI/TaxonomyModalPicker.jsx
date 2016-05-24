import _ from "lodash";
import React from "react";
import {Modal, Button, FormGroup, Checkbox, Badge} from "react-bootstrap";
import GoIActions from "../../actions/genomesOfInterestActions";

const TaxonomyModalPicker = ({taxa, close}) => {
  return (
      <Modal show={true} onHide={close}>
        <Modal.Header closeButton>
          <Modal.Title>Select Visible Genomes</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <FormGroup>
            {_.map(taxa, renderCheckboxComponent)}
          </FormGroup>
        </Modal.Body>

        <Modal.Footer>
          <Button primary onClick={close}>Done</Button>
        </Modal.Footer>
      </Modal>
  );
};

function renderCheckboxComponent({taxonId, isSelected, results, speciesName}) {
  const changeHandler = () => GoIActions.setTaxon(taxonId, !isSelected);
  return (
      <Checkbox key={taxonId}
                checked={isSelected}
                onChange={changeHandler}>
        {speciesName}
      </Checkbox>
  );
  // return (
  //     <Checkbox key={taxonId}
  //               checked={isSelected}
  //               onChange={changeHandler}>
  //       {speciesName}
  //       <Badge>{results}</Badge>
  //     </Checkbox>
  // )
}

export default TaxonomyModalPicker;


