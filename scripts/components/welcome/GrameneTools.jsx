import React from "react";
import {ListGroup, ListGroupItem, Media, Glyphicon} from "react-bootstrap";
import WelcomeActions from "../../actions/welcomeActions";

const GrameneTool = ({title, description, imgSrc, link, isExternal}) => {
  let external;
  if(isExternal) {
    external = <small title="This link opens a page from an external site"> <Glyphicon glyph="new-window" /></small>;
  }
  return (
      <ListGroupItem {...link} className="gramene-tool col-md-6">
        <Media>
          <Media.Left className="media-middle">
            <img src={imgSrc}/>
          </Media.Left>
          <Media.Body className="media-middle gramene-tool-text">
            <Media.Heading>{title}{external}</Media.Heading>
            <p className="gramene-tool-desc">{description}</p>
          </Media.Body>
        </Media>
      </ListGroupItem>
  );
};

function focusSearch() {
  WelcomeActions.flashSearchBox(250);
}

const GrameneTools = () =>
    <div className="tools-wrapper">
      <h2>Gramene Portals</h2>
      <ListGroup className="row">
        <GrameneTool title="Gramene Search"
                     description="Find and explore all data in Gramene database"
                     link={{onClick: focusSearch, href: 'javascript:void(0)'}}
                     imgSrc="assets/images/gramene_leaves.svg"/>
        <GrameneTool title="Genome Browser"
                     description="Browse genomes, with annotations, variation and comparative tools"
                     link={{href: "http://ensembl.gramene.org/genome_browser/index.html"}}
                     imgSrc="assets/images/welcome/genomes.png"/>
        <GrameneTool title="Plant Reactome"
                     description="Browse and analyze metabolic and regulatory pathways"
                     link={{href: "http://plantreactome.gramene.org/"}}
                     imgSrc="assets/images/welcome/pathways.png"/>
        <GrameneTool title="Plant Expression ATLAS"
                     description="Browse plant expression results at EBI ATLAS"
                     link={{href: "https://www.ebi.ac.uk/gxa/plant/experiments"}}
                     imgSrc="assets/images/welcome/ExpressionAtlas.png"
                     isExternal={true} />
        <GrameneTool title="BLAST"
                     description="Query our genomes with a DNA or protein sequence"
                     link={{href: "http://ensembl.gramene.org/Tools/Blast?db=core"}}
                     imgSrc="assets/images/welcome/BLAST.png"/>
        <GrameneTool title="Gramene Mart"
                     description="An advanced query interface powered by BioMart"
                     link={{href: "http://www.gramene.org/biomart/martview"}}
                     imgSrc="assets/images/welcome/Biomart250.png"/>
        <GrameneTool title="Outreach and Training"
                     description="Educational resources and webinars"
                     link={{href: "http://gramene.org/outreach"}}
                     imgSrc="assets/images/welcome/noun_553934.png"/>
        <GrameneTool title="Bulk Downloads"
                     description="FTP download of our data"
                     link={{href: "http://gramene.org/ftp-download"}}
                     imgSrc="assets/images/welcome/download.png"/>
        <GrameneTool title="Archive"
                     description="Legacy tools and data (markers, Cyc pathways, etc)"
                     link={{href: "http://gramene.org/archive"}}
                     imgSrc="assets/images/welcome/archive.jpg"/>
      </ListGroup>
    </div>;
export default GrameneTools;