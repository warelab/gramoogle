import React from "react";
import getProp from "lodash/get";
import isEqual from "lodash/isEqual";
import {Col} from "react-bootstrap";
import Browser from "./location/browser.jsx";
import QueryActions from "../../../actions/queryActions";
import {Detail, Title, Description, Content, Explore, Links} from "./generic/detail.jsx";

export default class Location extends React.Component {

  constructor(props) {
    super(props);
    this.initRegion();
    this.state = {
      visibleRange: this.initVisibleRange(props)
    };
    // this.handleViewChange = _.debounce(this._undebounced_handleViewChange, 50).bind(this);
  }
  
  initVisibleRange(props) {
    var location, span, padding, result;
    props = props || this.props;
    location = getProp(props, 'gene.location');
    if(!location) {
      throw new Error(`Could not find the location of the gene in props.`);
    }

    span = location.end - location.start + 1;
    padding = Math.floor(.1 * span);
    
    result = {
      chr: location.region,
      start: location.start - padding,
      end: location.end + padding
    };

    result.displayName = `${result.chr}:${result.start}-${result.end}`;

    return result;
  }

  initRegion() {
    var region, isChromosome, regionType, regionName;
    region = getProp(this.props, 'gene.location.region');
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

  handleViewChange(chr, start, end) {
    // console.log('view changed:', arguments);
    var visibleRange = {
      chr: chr,
      start: start,
      end: end,
      displayName: `${chr}:${start}-${end}`
    };

    if(!isEqual(visibleRange, this.state.visibleRange)) {
      this.setState({
        visibleRange: visibleRange
      });
    }
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
        name: `All within ${getProp(visible, 'displayName')}`,
        handleClick: ()=>this.updateQuery(true)
      });
    }
    return result;
  }

  links() {
    var gene = this.props.gene;
    return [
      {name: 'Gramene Ensembl', url: `//ensembl.gramene.org/${gene.system_name}/Gene/Summary?g=${gene._id}`},
      {name: 'PhytoMine', url: `https://phytozome.jgi.doe.gov/phytomine/keywordSearchResults.do?searchTerm=${gene._id}&searchSubmit=Search`},
      {name: 'Araport', url: `https://www.araport.org/search/thalemine/${gene._id}`}
    ]
  }

  render() {
    return (
      <Detail>
        <Title>Genome location: {this.renderGenePosition()}</Title>
        <Description>Currently viewing: {this.renderLocation()}</Description>
        <Content>
          {this.renderBrowser()}
        </Content>
        <Explore explorations={this.explorations()}/>
        <Links links={this.links()}/>
      </Detail>
    );
  }

  renderBrowser() {
    return (
      <Browser {...this.props} {...this.state} onViewChange={ this.handleViewChange.bind(this) }/>
    );
  }

  renderGenePosition() {
    var location = this.props.gene.location;
    return (
      <span className="location">
        <span className="region">{this.region.name}</span>:<span className="start">{location.start}</span>-<span
        className="end">{location.end}</span>
      </span>
    );
  }

  renderLocation() {
    var location = this.state.visibleRange;
    return (
      <span className="location">
        <span className="region">{location.chr}</span>:<span className="start">{location.start}</span>-<span
        className="end">{location.end}</span>
      </span>
    );
  }
}

Location.propTypes = {
  gene: React.PropTypes.object.isRequired,
  expanded: React.PropTypes.bool
};