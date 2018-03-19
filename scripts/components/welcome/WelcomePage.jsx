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
                <div className="plain-box"><h4> Maize B73 Genome Assembly and Gene Annotations</h4>

                  <p>An entirely new assembly of the maize genome (B73 RefGen_v4) was constructed from PacBio Single Molecule Real-Time (SMRT) sequencing at approximately 60-fold coverage and scaffolded with the aid of a high-resolution whole-genome restriction (optical) mapping. The pseudomolecules of maize B73 RefGen_v4 were assembled nearly end-to-end, representing a 52-fold improvement in average contig size relative to the previous reference (B73 RefGen_v3).</p>

                  <p>Genes were annotated with the Maker pipeline (Campbell <i>et al</i>, 2014) using 111,000 transcripts obtained by single-molecule sequencing. These long-read Iso-Seq data (Wang <i>et al</i>, 2016) improved annotation of alternative splicing, more than doubling the number of alternative transcripts from 1.5 to 3.8 per gene, thereby improving our knowledge of gene structure and transcript variation, resulting in substantial improvements including resolved gaps and misassembles, corrections to strand, consolidation of gene models, and anchoring of unanchored genes.</p>

                  <p>Gene annotation was performed in the laboratory of Doreen Ware (CSHL/USDA). Protein-coding genes were identified using MAKER-P software version 3.1 (Campbell <i>et al</i>, 2014) with the following transcript evidence: 111,151 PacBio Iso-Seq long-reads from 6 tissues (Wang <i>et al</i>, 2016), 69,163 full-length cDNAs deposited in Genbank (Alexandrov <i>et al</i>, 2008; Soderlund <i>et al</i>, 2009), 1,574,442 Trinity-assembled transcripts from 94 B73 RNA-Seq experiments (Law <i>et al</i>, 2015), and 112,963 transcripts assembled from deep sequencing of a B73 seedling (Martin <i>et al</i>, 2014). Additional evidence included annotated proteins from <i>Sorghum bicolor</i>, <i>Oryza sativa</i>, <i>Setaria italica</i>, <i>Brachypodium distachyon</i>, and <i>Arabidopsis thaliana</i> downloaded from Ensembl Plants Release 29 (Oct-2015). Gene calling was assisted by Augustus (Keller <i>et al</i>, 2011) and FGENESH (Salamov &amp; Solovyev, 2000) trained on maize and monocots, respectively. Low-confidence gene calls were filtered on the basis of an Annotation Edit Distance (AED) score and other criteria and are viewable as a separate track. In the end, the higher confidence set (called filtered gene set) has 39,324 protein coding genes. Gene annotations from B73 RefGen_v3 were mapped to the new assembly and are also available as a separate track. In addition, 2,532 long non-coding RNA (lncRNA) genes were mapped and annotated from prior studies (Li <i>et al</i>, 2014; Wang <i>et al</i>, 2016), while 2,290 tRNA genes were identified using tRNAscan-SE (Lowe &amp; Eddy, 1997), and 154 miRNA genes mapped from miRBase (Kozomara &amp; Griffiths-Jones, 2014).


                  </p><h4>Maize W22 Genome Assembly</h4>

                  <p>A new genome assembly of <a href="http://maize-pangenome-ensembl.gramene.org/Zea_maysw22"><em>Zea mays W22</em></a> is available here. The assembly (Zm-W22-REFERENCE-NRGENE-2.0) was generated in Roy J. Carver Biotechnology Center (Urbana, IL) at the University of Illinois and it's accompanying annotation was produced by the MAKER-P software in Doreen Ware's Lab.</p>

                  <p><b>This sequence has been released under the&nbsp;Toronto Agreement. No whole-genome research may be submitted for publication until the official publication for this genome assembly has been published.
                  </b></p>

                  <p>


                  </p><h4>Maize PH207 Genome Assembly</h4>

                  <p>A new genome assembly of <a href="http://maize-pangenome-ensembl.gramene.org/Zea_maysph207"><em>Zea mays PH207</em></a> is available here. The assembly (Zm-PH207-REFERENCE_NS-UIUC_UMN-1.0) was generated by Candy Hirsch's group at the University of Minnesota as well as it's accompanying annotation. PH207 is a key founder line to Iodent germplasm and represents an alternative to B73 (stiff stalk germplasm).</p>
                </div>
              </Col>
              <Col sm={6} className="posts-col">
                <div className="plain-box"><h4>What's in this release</h4>
                  <ul><li>Three Zea_mays genomes
                    <ul><li><a href="http://maize-pangenome-ensembl.gramene.org/Zea_mays"><em>Zea mays B73</em></a></li>
                      <li><a href="http://maize-pangenome-ensembl.gramene.org/Zea_maysw22"><em>Zea mays W22</em></a></li>
                      <li><a href="http://maize-pangenome-ensembl.gramene.org/Zea_maysph207"><em>Zea mays PH207</em></a></li>
                    </ul></li>
                    <li>Compara analysis
                      <ul><li>Protein comparative analysis generated a total of 23,442 GeneTree families comprising 422,202 individual genes (480,265 input proteins) from 15 species</li>
                        <li>Pairwise wholes genome alignments were constructed tween the following genomes</li>
                        <ul><li>Zea mays B73 v.s. Zea mays W22</li>
                          <li>Zea mays B73 v.s. Sorghum bicolor</li>
                          <li>Zea mays W22 v.s. Sorghum bicolor</li>
                        </ul>
                        <li>Synteny were calculated based on orthologs between genomes including the following pairs</li>
                        <ul><li>Zea mays B73 v.s. Zea mays W22</li>
                          <li>Zea mays B73 v.s. Zea mays PH207</li>
                          <li>Zea mays PH207 v.s. Zea mays W22</li>
                          <li>Zea mays B73 v.s. Sorghum bicolor</li>
                          <li>Zea mays W22 v.s. Sorghum bicolor</li>
                          <li>Zea mays PH207 v.s. Sorghum bicolor</li>
                        </ul>


                      </ul>
                    </li></ul></div>
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