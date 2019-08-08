import React from "react";
import {Alert} from "react-bootstrap";
import XLSX from 'xlsx';
import ReactTable from 'react-table'
import {Explore} from "../result/details/generic/detail.jsx";
import queryActions from "../../actions/queryActions";

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
    e.target.value = null;
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
          mappingStatus: 'Select the column that contains gene ids',
          fileName: f.name
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
  componentDidUpdate(prevProps) {
    if (prevProps.show && ! this.props.show) {
      this.setState({
        sheet: null,
        mappingStatus: 'Upload a set of gene IDs from a file'
      });
    }
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
    const url = global.gramene.defaultServer.replace('swagger','search');
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ids:idList})
    })
    .then(response => response.json())
    .then(json => {
      let idValidity = this.state.idValidity;
      json.mapped.forEach(id => {
        idValidity[id] = true
      });
      this.setState({idValidity: idValidity, listId: json.listId, mappedCount: json.mapped.length, mappingStatus: 'Mapping complete'});
    });
    this.setState({idValidity: idValidity, idCount: idList.length, idColumn: field, mappingStatus: 'Mapping in progress'})
  }
  createMappingFilter() {
    let fq, result;
    fq = 'saved_search:' + this.state.listId;
    result = {};
    result[fq] = {
      category: 'ID list',
      fq: fq,
      id: fq,
      display_name: `${this.state.fileName} ${this.state.idColumn}`
    };
    return result;
  }
  filterMapping() {
    queryActions.setAllFilters(this.createMappingFilter());
    if (this.props.closeModal) this.props.closeModal();
  }
  renderMapping() {
    return (
      <div>
        <p>The selected column has {this.state.idCount} unique values</p>
        {this.state.mappedCount && (
          <div>
            <p>{this.state.mappedCount} ids have been mapped.</p>
            <Button onClick={this.filterMapping.bind(this)}>Search</Button>
            {/*<Explore key="explore" explorations={[*/}
              {/*{*/}
                {/*name: 'Search',*/}
                {/*handleClick: this.filterMapping.bind(this),*/}
                {/*count: this.state.mappedCount*/}
              {/*}*/}
            {/*]}/>*/}
          </div>
        )}
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
        { this.state.sheet && <Alert bsStyle="success"><b>Selected file: </b>{this.state.fileName}</Alert> }
        <Alert bsStyle="info">{this.state.mappingStatus}</Alert>
        <input ref="userFile" type="file" style={{display: this.state.sheet ? "none" : "block"}}/>
        { this.state.sheet && this.renderSheet() }
      </div>
    );
  }
}

SearchUploadDropdown.propTypes = {
  onSelect: React.PropTypes.func.isRequired,
  show: React.PropTypes.bool.isRequired
};