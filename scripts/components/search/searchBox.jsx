import React from "react";
import _ from "lodash";
import {InputGroup, FormControl} from "react-bootstrap";

import Summary from "./summary.jsx";
import TaxonomyMenu from "../GoI/TaxonomyMenu.jsx";

import WelcomeActions from "../../actions/welcomeActions";

export default class SearchBox extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      emphasizeInput: false
    };
    _.bindAll(this, ['flashStart', 'flashEnd']);
  }

  componentWillMount() {
    console.log(WelcomeActions.flashSearchBox);
    console.log(WelcomeActions.flashSearchBox.completed);
    WelcomeActions.flashSearchBox.listen(this.flashStart);
    WelcomeActions.flashSearchBox.completed.listen(this.flashEnd);
  }

  flashStart() {
    this.setState({emphasizeInput: true});
    this.focus();
  }

  flashEnd() {
    this.setState({emphasizeInput: false});
  }

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

  className() {
    return this.state.emphasizeInput ? "highlight" : "no-highlight";
  }

  render() {
    return (
        <InputGroup>
          <FormControl className={this.className()}
                       type="search"
                       id="search-box"
                       tabIndex="1"
                       placeholder="Search for genes, species, pathways, ontology terms, domains…"
                       autoComplete="off"
                       standalone={true}
                       onChange={this.props.onQueryChange}/>
          <TaxonomyMenu toggleGenomesOfInterest={this.props.toggleGenomesOfInterest}
                        showGenomesOfInterest={this.props.showGenomesOfInterest}>
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
  toggleGenomesOfInterest: React.PropTypes.func.isRequired,
  showGenomesOfInterest: React.PropTypes.bool.isRequired
};