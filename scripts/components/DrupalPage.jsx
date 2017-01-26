import React from 'react';
import DrupalActions from "../actions/drupalActions";
import DrupalStore from "../stores/drupalStore";
import Spinner from "./Spinner.jsx";


export default class DrupalPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      drupal: DrupalStore.state
    };
  }

  componentWillMount() {
    this.unsubscribe = DrupalStore.listen(
      (state) => this.setState({drupal: state})
    );
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }

  bodyContent() {
    if(this.state.drupal.page) {
      // if (this.history) this.history.push(this.state.drupal.path);
      const body = this.state.drupal.page.body.und[0].safe_value;
      const title = this.state.drupal.page.title;
      const content = `<div><h3>${title}</h3><div>${body}</div></div>`;
      return (
        <div dangerouslySetInnerHTML={{__html:content}}>
        </div>);
    }
    else {
      return <Spinner />;
    }
  }

  render() {
    const drupal = this.props.params.drupalPath || `node/${this.props.params.drupalNode}`;
    if (this.state.drupal.path != drupal) {
      DrupalActions.fetchDrupalPage(drupal);
    }
    return (
      <div>{this.bodyContent()}</div>
    );
  }
}
