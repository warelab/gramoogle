import React from "react";
import DrupalStore from "../../stores/drupalStore";
import Intro from "./Intro.jsx";
import Posts from "./Posts.jsx";
import GrameneTools from "./GrameneTools.jsx";
import Spinner from "../Spinner.jsx";
import {shouldShowIntro, setIntroVisibility} from "../../welcome/intro";
import {Grid, Row, Col} from "react-bootstrap";
import WelcomeActions from "../../actions/welcomeActions";

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

  componentDidUpdate(prevProps, prevState) {
    window.scrollTo(0, 0);
    if (!this.props.children) {
      let ms = this.state.showIntro ? 600 : 300;
      WelcomeActions.flashSearchBox(ms);
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
              <Col sm={12} className="tools-col">
                {this.bodyContent()}
              </Col>
            </Row>
            <Row>
                <Col sm={6} className="posts-col">
<h2>  Prelimiary NAM genome assembly and Gene Annotations</h2>

This is a preliminary release of some of the genomes sequenced and assembled from NAM project. They are 
<ul><li>B73 AGPv5, NC350, Ki11</li> <li>non-stiff-stalks: Ky21i, M162W, Ms71</li> <li>Tropicals lines: CML247, CML333, Ki3 and CML52</li></ul>
We also includeded public released assembly  Zea mays B73_RefGen_v4 for comparision.

<p>Gene annotation was performed in the laboratory of Doreen Ware (CSHL/USDA). Protein-coding genes were identified using MAKER-P software version 3.1 (Campbell <i>et al</i>, 2014) with various edivence including flcDNAs, proteins. 

</p><p><b>This sequence has been released under the&nbsp;Toronto Agreement. No whole-genome research may be submitted for publication until the official publication for this genome assembly has been published.
</b></p>
            </Col>
            <Col sm={6} className="posts-col">
              <h2>Comparative analyses</h2>
              A total of 24,073 GeneTree families were constructed comprising 676,084 individual genes from 19 plant genomes with 716,754 input proteins. See stats <a href="http://maize-pangenome-ensembl.gramene.org/prot_tree_stats.html">here</a>
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