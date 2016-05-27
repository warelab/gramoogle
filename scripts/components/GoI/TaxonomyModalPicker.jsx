import _ from "lodash";
import React from "react";
import {Modal, Button, FormGroup} from "react-bootstrap";

import TaxonomyCheckbox from "./TaxonomyCheckbox.jsx";

const TaxonomyModalPicker = ({taxa, close}) => {
  return (
      <Modal show={true} onHide={close}>
        <Modal.Header closeButton>
          <Modal.Title>Select Visible Genomes</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <FormGroup>
            {renderCheckboxes(taxa)}
          </FormGroup>
        </Modal.Body>

        <Modal.Footer>
          <Button primary onClick={close}>Done</Button>
        </Modal.Footer>
      </Modal>
  );
};

function renderCheckboxes(taxa) {
  return _.map(taxa, (taxonProps, idx) => <TaxonomyCheckbox key={idx} {...taxonProps} />);
}
  
  // return (
  //     <Checkbox key={taxonId}
  //               checked={isSelected}
  //               onChange={changeHandler}>
  //       {speciesName}
  //       <Badge>{results}</Badge>
  //     </Checkbox>
  // )


export default TaxonomyModalPicker;


