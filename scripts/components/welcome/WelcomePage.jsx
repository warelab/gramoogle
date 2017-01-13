import React from "react";
import DrupalStore from "../../stores/drupalStore";
import DrupalActions from "../../actions/drupalActions";
import Intro from "./Intro.jsx";
import Posts from "./Posts.jsx";
import GrameneTools from "./GrameneTools.jsx";
import {shouldShowIntro, setIntroVisibility} from "../../welcome/intro";

import {Grid, Row, Col} from "react-bootstrap";

export default class Welcome extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      drupal: DrupalStore.state,
      showIntro: shouldShowIntro()
    };
  }

  componentWillMount() {
    if (this.props.context === 'client') {
      this.unsubscribe = DrupalStore.listen(
          (state) => this.setState({drupal: state})
      );
    }
  }

  componentWillUnmount() {
    if (this.unsubscribe) this.unsubscribe();
  }
  
  hideIntro() {
    this.setState({showIntro: false});
    setIntroVisibility(false);
  }

  bodyContent() {
    if(this.state.drupal.page) {
      return (
        <pre onClick={DrupalActions.hidePage}>
          {JSON.stringify(this.state.drupal.page, undefined, 2)}
        </pre>);
    }
    else {
      return <GrameneTools />;
    }
  }

  render() {
    return (
        <div>
          <Grid className="welcome">
            <Row>
              <Col sm={12}>
                {this.renderIntro()}
              </Col>
            </Row>
            <Row>
              <Col sm={9} className="tools-col">
                {this.bodyContent()}
              </Col>
              <Col sm={3} className="posts-col">
                <Posts feed={this.state.drupal.feed}/>
              </Col>
            </Row>
          </Grid>
        </div>
    );
  }
  
  renderIntro() {
    if(this.state.showIntro) {
      return <Intro onClose={this.hideIntro.bind(this)} />;
    }
  }
};

Welcome.propTypes = {
  context: React.PropTypes.string
};