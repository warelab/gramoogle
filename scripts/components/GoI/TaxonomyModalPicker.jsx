import _ from "lodash";
import React from "react";
import {Modal, Button, FormGroup, Checkbox} from "react-bootstrap";

import GoIActions from "../../actions/genomesOfInterestActions";

export default class TaxonomyModalPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.initSelectionState();
  }
  initSelectionState() {
    return _(this.props.taxa)
      .keyBy('taxonId')
      .mapValues( taxa => taxa.isSelected )
      .value();
  }
  updateTaxaAndClose() {
    let selectedTaxa = {};
    for (var taxon_id in this.state) {
      if (this.state[taxon_id]) {
        selectedTaxa[taxon_id] = true;
      }
    }
    GoIActions.setTaxa(selectedTaxa);
    this.props.close();
  }
  render() {
    const {taxa} = this.props;
    return (
      <Modal show={true} onHide={this.updateTaxaAndClose.bind(this)}>
        <Modal.Header closeButton>
          <Modal.Title>Select Visible Genomes</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <FormGroup>
            {this.renderCheckboxes(taxa)}
          </FormGroup>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={this.updateTaxaAndClose.bind(this)}>Done</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  handleSelection(taxonId) {
    let updatedState = {};
    updatedState[taxonId] = !this.state[taxonId];

    this.setState(updatedState);
  }

  renderCheckboxes(taxa) {
    return _.map(taxa, (taxonProps, idx) => (
      <Checkbox key={taxonProps.taxonId}
                checked={this.state[taxonProps.taxonId]}
                onChange={() => this.handleSelection(taxonProps.taxonId)}>
        {taxonProps.speciesName}
      </Checkbox>
    ));

    // <TaxonomyCheckbox key={idx} {...taxonProps} />);
  }
}
// return (
//     <Checkbox key={taxonId}
//               checked={isSelected}
//               onChange={changeHandler}>
//       {speciesName}
//       <Badge>{results}</Badge>
//     </Checkbox>
// )


