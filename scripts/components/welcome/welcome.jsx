import React from "react";
import WelcomeStore from "../../stores/welcomeStore";
import Intro from "./Intro.jsx";
import SearchInfo from "./SearchInfo.jsx";
import Features from "./Features.jsx";
import Examples from "./Examples.jsx";
import Portals from "./Portals.jsx";
import Posts from "./Posts.jsx";
import Navbar from "./Navbar.jsx";
import GrameneTools from "./GrameneTools.jsx";

import {Grid, Row, Col} from "react-bootstrap";

export default class Welcome extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      posts: require('../../../static/blogFeed.json')
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

  render() {
    return (
        <div>
          <Grid>
            <Row className="welcome">
              <Col sm={9}>
                <Intro />
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
};

Welcome.propTypes = {
  context: React.PropTypes.string
};