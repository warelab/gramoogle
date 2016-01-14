'use strict';

var React = require('react');
var bs = require('react-bootstrap');
var _ = require('lodash');

var QueryTerm = require('../../queryTerm.jsx');

var QueryActions = require('../../../../actions/queryActions');

var Location = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired
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
    var gene, location, region;

    gene = this.props.gene;
    location = gene.location;
    region = location.region;

    return (
      <div className="panel panel-default">
        <div className="panel-heading">
          <h5 className="panel-title">Location</h5>
        </div>
        <div className="panel-body">
          <dl class="dl-horizontal">
            <dt>Region</dt>
            <dd>{this.region.name}</dd>
            <dt>Position</dt>
            <dd>{location.start} - {location.end}</dd>
            <dt>Filter</dt>
            <dd>
              <QueryTerm name={"All genes on same " + this.region.type} handleClick={this.handleClickFactory()} />
              <QueryTerm name="Genes within 100kb" handleClick={this.handleClickFactory(100)} />
            </dd>
          </dl>
        </div>
      </div>
    );
  }
});

module.exports = Location;