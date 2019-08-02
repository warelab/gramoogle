import React from "react";
import _ from "lodash";
import {InputGroup, FormControl} from "react-bootstrap";
import Summary from "./summary.jsx";
import TaxonomyMenu from "../GoI/TaxonomyMenu.jsx";
import HelpButton from "./HelpButton.jsx";
import UploadButton from "./Uploadbutton.jsx";
import WelcomeActions from "../../actions/welcomeActions";
import getQueryStringFromURLParams from "../../search/getQueryStringFromURLParams";

export default class SearchBox extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      queryString: getQueryStringFromURLParams(),
      emphasizeInput: false
    };

    _.bindAll(this, ['flashStart', 'flashEnd', 'handleQueryStringChange']);
  }

  componentWillMount() {
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

  handleQueryStringChange(e) {
    const queryString = e.target.value;
    this.setState({queryString});
    this.props.onQueryChange(queryString);
  }

  clearSearchString() {
    this.setState({queryString: ''});
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
      this.props.onQueryChange(val);
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
                       value={this.state.queryString}
                       tabIndex="1"
                       placeholder="Search for genes, species, pathways, ontology terms, domains…"
                       autoComplete="off"
                       spellCheck="false" autoCorrect="off" autoCapitalize="off"
                       onChange={this.handleQueryStringChange}/>
          <InputGroup.Button>
            <UploadButton toggleUpload={this.props.toggleUpload}
                          showUpload={this.props.showUpload}/>
            <HelpButton toggleHelp={this.props.toggleHelp}
                        showHelp={this.props.showHelp}/>
            <TaxonomyMenu toggleGenomesOfInterest={this.props.toggleGenomesOfInterest}
                          showGenomesOfInterest={this.props.showGenomesOfInterest}>
              <Summary />
            </TaxonomyMenu>
          </InputGroup.Button>
          {this.props.children}
        </InputGroup>
    );
  }
};

SearchBox.propTypes = {
  onQueryChange: React.PropTypes.func.isRequired,
  toggleGenomesOfInterest: React.PropTypes.func.isRequired,
  showGenomesOfInterest: React.PropTypes.bool.isRequired,
  toggleHelp: React.PropTypes.func.isRequired,
  showHelp: React.PropTypes.bool.isRequired,
  toggleUpload: React.PropTypes.func.isRequired,
  showUpload: React.PropTypes.bool.isRequired
};