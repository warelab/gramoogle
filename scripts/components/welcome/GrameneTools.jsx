import React from "react";
import {ListGroup, ListGroupItem, Media} from "react-bootstrap";

import WelcomeActions from "../../actions/welcomeActions";

const GrameneTool = ({title, description, imgSrc, link}) =>
    <ListGroupItem {...link} className="gramene-tool">
      <Media>
        <Media.Left>
          <img width="42" src={imgSrc}/>
        </Media.Left>
        <Media.Body>
          <Media.Heading>{title}</Media.Heading>
          <p>{description}</p>
        </Media.Body>
      </Media>
    </ListGroupItem>;

function focusSearch(e) {
  WelcomeActions.flashSearchBox(250);
  // const searchBox = document.querySelector('#search-box');
  // if (searchBox) {
  //   searchBox.focus();
  //   searchBox.click();
  // }
}

const GrameneTools = () =>
    <div className="tools-wrapper">
      <h2>Gramene Portals</h2>
      <ListGroup>
        <GrameneTool title="Gramene Search"
                     description="Find and explore all data in Gramene database"
                     link={{onClick: focusSearch, href: 'javascript:(function noop(){})()'}}
                     imgSrc="assets/images/gramene_leaves.svg"/>
        <GrameneTool title="Genome Browser"
                     description="We share the Ensembl infrastructure published by the EBI"
                     link={{href: "http://ensembl.gramene.org/genome_browser/index.html"}}
                     imgSrc="assets/images/welcome/genomes.png"/>
        <GrameneTool title="Plant Reactome"
                     description="Browse metabolic & regulatory pathways"
                     link={{href: "http://plantreactome.gramene.org/"}}
                     imgSrc="assets/images/welcome/pathways.png"/>
        <GrameneTool title="Plant Expression ATLAS"
                     description="Browse plant expression results at EBI ATLAS"
                     link={{href: "https://www.ebi.ac.uk/gxa/plant/experiments"}}
                     imgSrc="assets/images/welcome/ExpressionAtlas.png"/>
        <GrameneTool title="BLAST"
                     description="Query our genomes with a DNA or protein sequence of interest"
                     link={{href: "http://ensembl.gramene.org/Tools/Blast?db=core"}}
                     imgSrc="assets/images/welcome/BLAST.png"/>
        <GrameneTool title="BioMart"
                     description="An advanced query interface"
                     link={{href: "http://www.gramene.org/biomart/martview"}}
                     imgSrc="assets/images/welcome/mart.png"/>
        <GrameneTool title="Bulk Downloads"
                     description="FTP download of our data"
                     link={{href: "http://gramene.org/ftp-download"}}
                     imgSrc="assets/images/welcome/download.jpg"/>
        <GrameneTool title="Archive"
                     description="Legacy tools and data"
                     link={{href: "http://gramene.org/archive"}}
                     imgSrc="assets/images/welcome/archive.jpg"/>
      </ListGroup>
    </div>;
export default GrameneTools;