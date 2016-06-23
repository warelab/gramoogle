import React from "react";
import {Alert} from "react-bootstrap";
import Features from "./Features.jsx";
import Examples from "./Examples.jsx";

export default class SearchHelpDropdown extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
        <div>
          <Alert bsStyle="info">
            Type to search! Try typing a gene identifier,
            ontology term, pathway, or functional domain
          </Alert>
          <Features/>
          <Examples {...this.props} />
        </div>
    );
  }
}

SearchHelpDropdown.propTypes = {
  onSelect: React.PropTypes.func.isRequired
};

export default SearchHelpDropdown;