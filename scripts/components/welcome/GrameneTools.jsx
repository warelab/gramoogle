import React from "react";
import ReactGA from "react-ga";
import {ListGroup, ListGroupItem, Media, Glyphicon} from "react-bootstrap";
import {OverlayTrigger, Popover} from "react-bootstrap";
import WelcomeActions from "../../actions/welcomeActions";
import { browserHistory } from 'react-router';
var ensemblURL = require('../../../package.json').gramene.ensemblURL;

function possiblyShowMessage(title) {
  if (false && title === 'Plant Reactome') {
    const popoverTop = (
      <Popover id="popover-positioned-bottom" title="Offline for maintenance this weekend">
        The Plant Reactome hosting provider is performing scheduled server maintenance starting Friday Sep 14 at 6PM EST until midnight Sunday Sep 16. Plant Reactome services will be offline during this time. We apologize for any inconvenience.
      </Popover>
    );
    return (
      <OverlayTrigger trigger="hover" placement="bottom" overlay={popoverTop}>
        <medium style={{color:'darkorange'}} title="Server maintenance"> <Glyphicon glyph="warning-sign" /></medium>
      </OverlayTrigger>
    )
  }
}

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
            <Media.Heading>{title}{external}{possiblyShowMessage(title)}</Media.Heading>
            <p className="gramene-tool-desc">{description}</p>

          </Media.Body>
        </Media>
      </ListGroupItem>
  );
};

function focusSearch() {
  WelcomeActions.flashSearchBox(250);
}

function drupalLink(path) {
  return {
    onClick: () => browserHistory.push(path),
    href: "javascript:void(0);"
  };
}

function externalLink(path) {
  return {
    onClick: () => {
      ReactGA.outboundLink({
        label: path
      }, function () {
        window.location.href = path;
      });
    },
    href: "javascript:void(0);"
  }
}

const GrameneTools = () =>
    <div className="tools-wrapper">
      <h3>Gramene Portals</h3>
      <ListGroup className="row">
        {/*<GrameneTool title="Gramene Search"*/}
                     {/*description="Find and explore all data in Gramene database"*/}
                     {/*link={{onClick: focusSearch, href: 'javascript:void(0)'}}*/}
                     {/*imgSrc="/assets/images/gramene_leaves.svg"/>*/}
        <GrameneTool title="Genome Browser"
                     description="Browse genomes with annotations, variation and comparative tools"
                     link={externalLink(`${ensemblURL}/index.html`)}
                     imgSrc="/assets/images/welcome/ensemblgramene.png"/>
        <GrameneTool title="Plant Reactome"
                     description="Browse and analyze metabolic and regulatory pathways"
                     link={externalLink("http://plantreactome.gramene.org/")}
                     imgSrc="/assets/images/welcome/plantReactome.svg"/>
        <GrameneTool title="Tools"
                     description="Tools for processing both our data and yours"
                     link={externalLink(`${ensemblURL}/tools.html`)}
                     imgSrc="/assets/images/welcome/tools.png"/>
        <GrameneTool title="Plant Expression ATLAS"
                     description="Browse plant expression results at EBI ATLAS"
                     link={externalLink("https://www.ebi.ac.uk/gxa/plant/experiments")}
                     imgSrc="/assets/images/welcome/ExpressionAtlas.png"
                     isExternal={true} />
        <GrameneTool title="BLAST"
                     description="Query our genomes with a DNA or protein sequence"
                     link={externalLink(`${ensemblURL}/Tools/Blast?db=core`)}
                     imgSrc="/assets/images/welcome/BLAST.png"/>
        <GrameneTool title="Gramene Mart"
                     description="An advanced query interface powered by BioMart"
                     link={externalLink(`${ensemblURL}/biomart/martview`)}
                     imgSrc="/assets/images/welcome/Biomart250.png"/>
        <GrameneTool title="Track Hub Registry"
                     description="A global centralised collection of publicly accessible track hubs"
                     link={externalLink("http://trackhubregistry.org")}
                     imgSrc="/assets/images/welcome/TrackHub.png"
                     isExternal={true} />
        <GrameneTool title="Outreach and Training"
                     description="Educational resources and webinars"
                     link={drupalLink('/outreach')}
                     imgSrc="/assets/images/welcome/noun_553934.png"/>
        <GrameneTool title="Bulk Downloads"
                     description="FTP download of our data"
                     link={drupalLink('/ftp-download')}
                     imgSrc="/assets/images/welcome/download.png"/>
        <GrameneTool title="Archive"
                     description="Legacy tools and data (markers, Cyc pathways, etc)"
                     link={drupalLink('/archive')}
                     imgSrc="/assets/images/welcome/archive.jpg"/>
      </ListGroup>
    </div>;
export default GrameneTools;