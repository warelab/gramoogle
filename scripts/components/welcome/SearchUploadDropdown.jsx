import React from "react";
import {Alert} from "react-bootstrap";
import XLSX from 'xlsx';
import ReactTable from 'react-table'

export default class SearchUploadDropdown extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      sheet: null,
      mappingStatus: 'Upload a set of gene IDs from a file'
    }
  }
  handleFile(e) {
    var files = e.target.files, f = files[0];
    var reader = new FileReader();
    var theCmp = this;
    reader.onload = function(e) {
      var data = new Uint8Array(e.target.result);
      try {
        var workbook = XLSX.read(data, {type: 'array'});
      }
      catch(error) {
        console.log(error);
        return;
      }
      if (workbook && workbook.Sheets) {
        theCmp.setState({
          sheet: XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]),
          mappingStatus: 'Select the column that contains gene ids'
        })
      }
      else {
        console.log('failed to parse table');
      }
    };
    reader.readAsArrayBuffer(f);
  }
  componentDidMount() {
    this.stopListening = this.refs.userFile.addEventListener('change', this.handleFile.bind(this), false);
  }
  componentWillUnmount() {
    this.stopListening();
  }
  useColumn(e) {
    const field = e.target.value;
    let idValidity = {};
    this.state.sheet.forEach(row => {
      idValidity[row[field]] = false;
    });
    const idList = Object.keys(idValidity);
    console.log('this is where we post the idList',idList);
    this.setState({idValidity: idValidity, idCount: idList.length, mappingStatus: 'Mapping in progress'})
  }
  renderMapping() {
    return (
      <div>
        <p>The selected column has {this.state.idCount} unique values</p>
      </div>
    )
  }
  renderSheet() {
    let columns = Object.keys(this.state.sheet[0]).map(field => {
      return { Header: (
        <div>
          <input style={{margin: '.4rem'}} type="radio" id={field} name="idColumn" value={field}
                 onChange={(e)=>this.useColumn(e)}/>
          <label>{field}</label>
        </div>
        ), accessor: field }
    });
    return (
      <div>
        {this.state.idCount && this.renderMapping() }
        <ReactTable
          data={this.state.sheet}
          columns={columns}
          sortable={false}
          defaultPageSize={10}
        />
      </div>
    )
  }
  render() {
    return (
      <div>
        <Alert bsStyle="info">{this.state.mappingStatus}</Alert>
        { !this.state.sheet && <input ref="userFile" type="file"/> }
        { this.state.sheet && this.renderSheet() }
      </div>
    );
  }
}

SearchUploadDropdown.propTypes = {
  onSelect: React.PropTypes.func.isRequired
};