import React from "react";
import {Dropdown, Glyphicon} from "react-bootstrap";
import SearchUploadDropdown from "../welcome/SearchUploadDropdown.jsx";

export default class UploadButton extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
        <Dropdown id="search-upload-button"
                  onToggle={this.props.toggleUpload}
                  open={this.props.showUpload}>
          <Dropdown.Toggle noCaret><Glyphicon glyph="upload"/></Dropdown.Toggle>
          <Dropdown.Menu className="search-upload-popover">
            <SearchUploadDropdown onSelect={this.props.toggleUpload} />
          </Dropdown.Menu>
        </Dropdown>
    );
  }
}
UploadButton.propTypes = {
  toggleUpload: React.PropTypes.func.isRequired,
  showUpload: React.PropTypes.bool.isRequired
};