import React from "react";
import _ from "lodash";
import {Dropdown, MenuItem} from "react-bootstrap";
import visualizationStore from "../../stores/visualizationStore";
import searchStore from "../../stores/searchStore";
import GoIActions from "../../actions/genomesOfInterestActions";
import {matchesNamedSpeciesSet, getNamedSpeciesSet} from "../../search/genomesOfInterest";
import TaxonomyModalPicker from "./TaxonomyModalPicker.jsx";

export default class TaxonomyMenu extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      taxonomy: _.get(visualizationStore, 'taxonomy'),
      selectedTaxa: _.get(searchStore, 'state.global.taxa')
    };
  }

  componentDidMount() {
    this.unsubVis = visualizationStore.listen(
        (visState) => this.setState({taxonomy: visState.taxonomy})
    );
    this.unsubSearch = searchStore.listen(
        (searchState) => this.setState({selectedTaxa: searchState.global.taxa})
    );
  }

  componentWillUnmount() {
    this.unsubVis();
    this.unsubSearch();
  }

  defaultIsSelected() {
    return matchesNamedSpeciesSet('default', this.state.selectedTaxa);
  }

  showAllIsSelected() {
    const numSelected = _.size(this.state.selectedTaxa);
    return numSelected == 0 || numSelected == _.size(this.state.taxonomy.leafNodes());
  }

  customSpeciesSetSelected() {
    return !(this.showAllIsSelected() || this.defaultIsSelected());
  }

  showCustomSelectionModal() {
    this.setState({showModal: true});
  }

  showAllSpecies() {
    GoIActions.setTaxa({});
  }

  showNamedSpeciesSet(selection) {
    GoIActions.setTaxa(getNamedSpeciesSet(selection));
  }

  handleSelection(selection) {
    switch (selection) {
      case "custom":
        this.showCustomSelectionModal();
        break;
      case "all":
        this.showAllSpecies();
        break;
      default:
        this.showNamedSpeciesSet(selection);
    }
  }

  closeModal() {
    this.setState({showModal: false});
  }

  checkboxData() {
    const {taxonomy, selectedTaxa} = this.state;

    if (taxonomy && selectedTaxa) {
      return taxonomy.leafNodes().map((node) => {
        const taxonId = node.model.id;
        const speciesName = node.model.name;
        const isSelected = !!selectedTaxa[taxonId];
        let results;
        if (node.model.results) {
          results = node.model.results.count;
        }
        else {
          results = node.model.geneCount;
        }

        return {taxonId, isSelected, results, speciesName};
      });
    }
  }

  render() {
    let modal;

    if (this.state.showModal) {
      modal = <TaxonomyModalPicker taxa={this.checkboxData()} close={this.closeModal.bind(this)}/>
    }

    return (
        <Dropdown id="genomes-of-interest-dropdown" className="input-group-btn">
          <Dropdown.Toggle>
            {this.props.children}
          </Dropdown.Toggle>
          <Dropdown.Menu onSelect={this.handleSelection.bind(this)}>
            {/*<MenuItem eventKey="default"*/}
                      {/*active={this.defaultIsSelected()}>*/}
              {/*Gramene Default Species*/}
            {/*</MenuItem>*/}
            <MenuItem eventKey="all"
                      active={this.showAllIsSelected()}>
              Show All Species
            </MenuItem>
            <MenuItem divider/>
            <MenuItem eventKey="custom"
                      active={this.customSpeciesSetSelected()}>
              Pick Species from List
            </MenuItem>
          </Dropdown.Menu>
                  {modal}
        </Dropdown>
    );
  }
}

TaxonomyMenu.propTypes = {
  children: React.PropTypes.element.isRequired
};