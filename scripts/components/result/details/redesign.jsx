import React from "react";
import _ from "lodash";
import {Col} from "react-bootstrap";
import DallianceBrowser from "./location/dallianceBrowser.jsx";
import QueryActions from "../../../actions/queryActions";
import {Detail, Title, Content, Explore, Links} from "./generic/detail.jsx";

export default class Redesign extends React.Component {

  constructor(props) {
    super(props);
    this.initRegion();
    this.state = {
      visibleRange: {
        chr: props.gene.location.region,
        start: props.gene.location.start,
        end: props.gene.location.end
      }
    };
    this.handleViewChange = _.debounce(this._undebounced_handleViewChange, 100).bind(this);
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

  // handleSelection(selection) {
  //   this.setState({ selection: selection });
  // }

  _undebounced_handleViewChange(chr, start, end) {
    console.log('view changed:', arguments);
    this.setState({
      visibleRange: {
        chr: chr,
        start: start,
        end: end,
        displayName: `${chr}:${start}-${end}`
      }
    });
  }

  updateQuery(restrictToVisibleRange) {
    var location, geneName, visibleRange, filter, filterDisplayName, fq;
    location = this.props.gene.location;
    geneName = this.props.gene.name;

    fq = `map:${location.map} AND region:${location.region}`;

    if (restrictToVisibleRange) {
      visibleRange = this.state.visibleRange;

      fq += ` AND (start:[${visibleRange.start} TO ${visibleRange.end}]`
        + ` OR end:[${visibleRange.start} TO ${visibleRange.end}])`;

      filterDisplayName = visibleRange.displayName;
    } else {
      filterDisplayName = "Shares " + this.region.type + " with " + geneName;
    }

    console.log("User asked to filter by location");
    filter = {
      category: 'Location',
      id: fq,
      fq: fq,
      display_name: filterDisplayName
    };

    QueryActions.removeAllFilters();
    QueryActions.setFilter(filter);
  }

  explorations() {
    var visible, result;
    visible = this.state.visibleRange;
    result = [
      {
        name: `All on ${this.region.name}`,
        handleClick: ()=>this.updateQuery(false)
      }
    ];
    if (visible) {
      result.push({
        name: `All within ${_.get(visible, 'displayName')}`,
        handleClick: ()=>this.updateQuery(true)
      });
    }
    return result;
  }

  links() {
    return [
      {name: 'Gramene Ensembl', url: 'http://ensembl.gramene.org/'},
      {name: 'Phytozome', url: 'http://ensembl.gramene.org/'},
      {name: 'Araport', url: 'http://ensembl.gramene.org/'}
    ]
  }

  render() {
    return (
      <Detail>
        <Title>{this.renderLocation()}</Title>
        <Content>
          <Col xs={12} sm={9}>
            {this.renderBiodalliance()}
          </Col>
          <Col xs={12} sm={3}>
            Config
          </Col>
        </Content>
        <Explore explorations={this.explorations()}/>
        <Links links={this.links()}/>
      </Detail>
    );
  }

  renderBiodalliance() {
    return (
      <DallianceBrowser {...this.props} onViewChange={ this.handleViewChange }/>
    );
  }

  renderLocation() {
    var location = this.props.gene.location;
    return (
      <span className="location">
        <span className="region">{this.region.name}</span>:<span className="start">{location.start}</span>-<span
        className="end">{location.end}</span>
      </span>
    );
  }
}

Redesign.propTypes = {
  gene: React.PropTypes.object.isRequired,
  expanded: React.PropTypes.bool
};