import React from "react";
import Summary from "./summary.jsx";
import TaxonomyMenu from "../GoI/TaxonomyMenu.jsx";
import {InputGroup, FormControl} from "react-bootstrap";

export default class SearchBox extends React.Component {

  getInputNode() {
    return document.getElementById('search-box');
  }

  clearSearchString() {
    this.getInputNode().value = '';
  }

  focus() {
    this.getInputNode().focus();
  }

  value() {
    return this.getInputNode().value;
  }

  componentDidMount() {
    const val = this.value();
    if (val !== '') {
      this.props.onQueryChange({target: {value: val}});
    }
    this.focus();
  }

  render() {
    return (
        <InputGroup>
          <FormControl type="search"
                       id="search-box"
                       tabIndex="1"
                       placeholder="Search for genes…"
                       autoComplete="off"
                       standalone={true}
                       onChange={this.props.onQueryChange} />
          <TaxonomyMenu>
            <Summary results={this.props.results}/>
          </TaxonomyMenu>
          {this.props.children}
        </InputGroup>
    );
  }
};

SearchBox.propTypes = {
  results: React.PropTypes.object.isRequired,
  onQueryChange: React.PropTypes.func.isRequired,
};