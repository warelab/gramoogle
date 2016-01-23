'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');

var QueryTerm = require('../queryTerm.jsx');
var QueryActions = require('../../../actions/queryActions');

var DallianceBrowser = require('./location/dallianceBrowser.jsx');
//var Location = require('./location/location.jsx');

var Location = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired,
    expanded: React.PropTypes.bool
  },

  componentWillMount: function() {
    var region, isChromosome, regionType, regionName;
    region = _.get(this.props, 'gene.location.region');
    if(region) {
      isChromosome = /^\d+$/.test(region);
      if(isChromosome) {
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
  },

  handleClickFactory: function(within) {
    return function() {
      var location, geneName, filter, min, max, name, fq;
      location = this.props.gene.location;
      geneName = this.props.gene.name;

      fq = 'map:' + location.map + ' AND ' +
        'region:' + location.region;

      if(within) {
        min = location.start - (within * 1000); // convert kb to bases.
        max = location.end + (within * 1000);

        fq += ' AND (end:[' + min + ' TO ' + location.start +
          '] OR start:[' + location.end + ' TO ' + max + '])';

        name = "Within " + within + "kb of " + geneName;
      } else {
        name = "Shares " + this.region.type + " with " + geneName;
      }

      console.log("User asked to filter by location");
      filter = {
        category: 'Location',
        id: fq,
        fq: fq,
        display_name: name
      };

      QueryActions.setFilter(filter);
    }.bind(this);
  },

  render: function () {
    var gene, location, ensemblSummaryUrl;

    gene = this.props.gene;
    location = gene.location;

    // TODO: USe CSS Substring matching to put little icon after link to ensembl
    // http://blog.teamtreehouse.com/css3-substring-matching-attribute-selectors
    ensemblSummaryUrl = '//ensembl.gramene.org/' + gene.system_name + '/Gene/Summary?g=' + gene._id;

    return (
      <div>
        <dl class="dl-horizontal">
          <dt>Region</dt>
          <dd>{this.region.name}</dd>
          <dt>Position</dt>
          <dd>{location.start} - {location.end}</dd>
          <DallianceBrowser gene={gene} expanded={this.props.expanded} />
          <dt>Filter</dt>
          <dd>
            <QueryTerm name={"All genes on same " + this.region.type} handleClick={this.handleClickFactory()} />
            <QueryTerm name="Genes within 100kb" handleClick={this.handleClickFactory(100)} />
          </dd>
          <dt>Links</dt>
          <dd>
            <ul>
              <li>
                <a href={ensemblSummaryUrl}>Ensembl Gene view</a>
              </li>
            </ul>
          </dd>
        </dl>
      </div>
    );
    //return (
    //  <div>
    //    <DallianceBrowser gene={gene} expanded={this.props.expanded} />
    //    <bs.Row>
    //      <bs.Col xs={12} md={4}>
    //        <Location gene={gene} />
    //      </bs.Col>
    //      <bs.Col xs={12} md={8}>
    //        <h5>Links</h5>
    //        <ul>
    //          <li>
    //            <a href={ensemblSummaryUrl}>Ensembl Gene view</a>
    //          </li>
    //        </ul>
    //      </bs.Col>
    //    </bs.Row>
    //  </div>
    //);
  }
});

module.exports = Location;