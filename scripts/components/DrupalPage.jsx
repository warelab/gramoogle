import React from 'react';
import axios from "axios";


export default class DrupalPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      page: null
    };
  }

  componentDidMount() {
    this.fetchPage()
  }

  componentDidUpdate (prevProps) {
    let oldNode = prevProps.params.drupalPath || prevProps.params.drupalNode;
    let newNode = this.props.params.drupalPath || this.props.params.drupalNode;
    if (newNode !== oldNode)
      this.fetchPage();
  }

  componentWillUnmount () {
    this.ignoreLastFetch = true;
  }

  fetchPage () {
    let drupal = this.props.params.drupalPath || `node/${this.props.params.drupalNode}`;
    let url = `http://data.gramene.org/drupal/${drupal}`;
    axios.get(url).then(response => {
      if (!this.ignoreLastFetch) {
        const title = response.data.title;
        const body = response.data.body.und[0].safe_value;
        const content = `<h3>${title}</h3><div>${body}</div>`;
        this.setState({ page: content });
      }
    })
  }

  render() {
    return (
      <div dangerouslySetInnerHTML={{__html:this.state.page}}></div>
    );
  }
}
