import React from 'react';
import _ from 'lodash';
import { Col } from 'react-bootstrap';
import DallianceBrowser from './location/dallianceBrowser.jsx';

import {Detail, Title, Description, Content, Explore, Links}
  from "./generic/detail.jsx";

export default class Redesign extends React.Component {

  constructor(props) {
    super(props);
    this.initRegion();
    this.state = {};
  }

  initRegion() {
    var region, isChromosome, regionType, regionName;
    region = _.get(this.props, 'gene.location.region');
    if (region) {
      isChromosome = /^\d+$/.test(region);
      if (isChromosome) {
        regionType = 'chromosome';
        regionName = 'Chromosome ' + region;
      }
      else {
        regionType = 'scaffold';
        regionName = region;
      }
      this.region = {
        isChromsome: isChromosome,
        name: regionName,
        type: regionType
      };
    }
  }

  handleSelection(selection) {
    this.setState({ selection: selection });
  }

  location() {
    var location = this.props.gene.location;
    return (
      <span className="location">
        <span className="region">{this.region.name}</span>:<span className="start">{location.start}</span>-<span className="end">{location.end}</span>
      </span>
    );
  }

  explorations() {
    return [
      {name: 'Genes on same chr', handleClick: ()=>0},
      {name: 'All within 100kb', handleClick: ()=>0}
    ];
  }

  links() {
    return [
      {name: 'Gramene Ensembl', url: 'http://ensembl.gramene.org/'},
      {name: 'Phytozome', url: 'http://ensembl.gramene.org/'},
      {name: 'Araport', url: 'http://ensembl.gramene.org/'}
    ]
  }

  biodalliance() {
    return (
      <DallianceBrowser {...this.props} />
    );
  }

  render() {
    return (
      <Detail>
        <Title>{this.location()}</Title>
        <Content>
          <Col xs={12} sm={9}>
            {this.biodalliance()}
          </Col>
          <Col xs={12} sm={3}>
            Config
          </Col>
        </Content>
        <Explore explorations={this.explorations()} />
        <Links links={this.links()} />
      </Detail>
    );
  }
}

Redesign.propTypes = {
  gene: React.PropTypes.object.isRequired,
  expanded: React.PropTypes.bool
};