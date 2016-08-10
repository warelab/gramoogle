import React from "react";
import WelcomeStore from "../../stores/welcomeStore";
import Intro from "./Intro.jsx";
import Posts from "./Posts.jsx";
import GrameneTools from "./GrameneTools.jsx";
import {shouldShowIntro, setIntroVisibility} from "../../welcome/intro";

import {Grid, Row, Col} from "react-bootstrap";

export default class Welcome extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: require('../../../static/blogFeed.json'),
      showIntro: shouldShowIntro()
    };
  }

  componentWillMount() {
    if (this.props.context === 'client') {
      this.unsubscribe = WelcomeStore.listen(
          (posts) => this.setState({posts: posts})
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
              <Col sm={9}>
                <GrameneTools />
              </Col>
              <Col sm={3}>
                <Posts {...this.state}/>
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