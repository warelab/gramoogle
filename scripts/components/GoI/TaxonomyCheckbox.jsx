import React from 'react';
import GoIActions from "../../actions/genomesOfInterestActions";
import {Checkbox, Badge} from "react-bootstrap";

export default class TaxonomyCheckbox extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }
  changeHandler() {
    const newSelectionState = !this.props.isSelected;
    this.setState({ checked: newSelectionState });
    GoIActions.setTaxon(this.props.taxonId, newSelectionState);
  }
  render() {
    const {taxonId, isSelected, results, speciesName} = this.props;

    // overwrite application state with local to combat latency in checking.
    const selectionState = _.isUndefined(this.state.checked) ? isSelected : this.state.checked;

    // currently not including the following as it's a little misleading.
    // maybe if we rerun the search without taxon constraint.
    // <Badge>{results}</Badge>

    return (
        <Checkbox key={taxonId}
                  checked={selectionState}
                  onChange={this.changeHandler.bind(this)}>
                  {speciesName}
        </Checkbox>
    );
  }
}

TaxonomyCheckbox.propTypes = {
  taxonId: React.PropTypes.number.isRequired,
  isSelected: React.PropTypes.bool.isRequired,
  speciesName: React.PropTypes.string.isRequired,
  results: React.PropTypes.number
};