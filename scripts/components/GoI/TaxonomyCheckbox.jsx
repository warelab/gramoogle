import React from 'react';
import {Checkbox, Badge} from "react-bootstrap";

export default class TaxonomyCheckbox extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    const {taxonId, isSelected, onChange, speciesName} = this.props;

    return (
        <Checkbox key={taxonId}
                  checked={isSelected}
                  onChange={onChange}>
                  {speciesName}
        </Checkbox>
    );
  }
}

TaxonomyCheckbox.propTypes = {
  taxonId: React.PropTypes.number.isRequired,
  speciesName: React.PropTypes.string.isRequired,
  isSelected: React.PropTypes.bool.isRequired,
  onChange: React.PropTypes.func.isRequired
};