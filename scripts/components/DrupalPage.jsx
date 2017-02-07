import React from 'react';
import axios from "axios";
import Spinner from './Spinner.jsx';


export default class DrupalPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      aliases: {}
    };
  }

  componentWillMount() {
    this.fetchAliases();
  }

  componentWillUnmount () {
    this.ignoreLastFetch = true;
  }

  fetchAliases () {
    let url = `/aliases`;
    axios.get(url).then(response => {
      if (!this.ignoreLastFetch) {
        this.setState({ aliases: response.data });
      }
    })
  }

  render() {
    let nid = null;
    if (this.props.params.drupalPath) {
      if (this.state.aliases[this.props.params.drupalPath]) {
        nid = this.state.aliases[this.props.params.drupalPath];
      }
    }
    else if (this.props.params.drupalNode) {
      nid = this.props.params.drupalNode;
    }
    if (nid) {
      return (
        <iframe src={`http://www.gramene.org/ww?nid=${nid}`} frameBorder="0" width="100%" height="650px">
          <p>browser doesn't support iframes</p>
        </iframe>
      );
    }
    else {
      return <Spinner />;
    }
  }
}
