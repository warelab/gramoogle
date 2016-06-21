import React from "react";
import {Dropdown, Alert} from "react-bootstrap";
import Features from "./Features.jsx";
import Examples from "./Examples.jsx";

export default class SearchHelpDropdown extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
        <Dropdown.Menu className="search-help-popover">
          <Alert bsStyle="info">
            Type to search! Try typing a gene identifier,
            ontology term, pathway, or functional domain
          </Alert>
          <Features/>
          <Examples/>
        </Dropdown.Menu>
    );
  }
}
export default SearchHelpDropdown;