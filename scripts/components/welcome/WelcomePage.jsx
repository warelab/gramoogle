import React from "react";
import DrupalStore from "../../stores/drupalStore";
import Intro from "./Intro.jsx";
import Posts from "./Posts.jsx";
import GrameneTools from "./GrameneTools.jsx";
import Spinner from "../Spinner.jsx";
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
    console.log("WelcomePAge componentWillMount", this);
    if (!this.props.serverRenderMode) {
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
    if (this.props.children) {
      return this.props.children;
    }
    else if (this.props.serverRenderMode === 'static') {
      return <Spinner />;
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
  serverRenderMode: React.PropTypes.string
};