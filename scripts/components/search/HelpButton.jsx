import React from "react";
import {Dropdown, Glyphicon} from "react-bootstrap";
import SearchHelpDropdown from "../welcome/SearchHelpDropdown.jsx";

export default class HelpButton extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
        <Dropdown id="search-help-button"
                  onToggle={this.props.toggleHelp}
                  open={this.props.showHelp}>
          <Dropdown.Toggle noCaret><Glyphicon glyph="question-sign"/></Dropdown.Toggle>
          <Dropdown.Menu className="search-help-popover">
            <SearchHelpDropdown/>
          </Dropdown.Menu>
        </Dropdown>
    );
  }
}
HelpButton.propTypes = {
  toggleHelp: React.PropTypes.func.isRequired,
  showHelp: React.PropTypes.bool.isRequired
};