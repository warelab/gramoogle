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
      <ListGroup className="row">
        <GrameneTool title="Search"
                     description="Search the pan-maize gene set"
                     link={{onClick: focusSearch, href: 'javascript:void(0)'}}
                     imgSrc="/assets/images/gramene_leaves.svg"/>
        <GrameneTool title="Genome Browser"
                     description="Browse genomes with annotations, variation and comparative tools"
                     link={externalLink(`${ensemblURL}/genome_browser/index.html`)}
                     imgSrc="/assets/images/welcome/ensemblgramene.png"/>
      </ListGroup>
    </div>;
export default GrameneTools;