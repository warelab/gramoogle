'use strict';

var React = require('react');
var bs = require('react-bootstrap');

var QueryTerm = require('../../queryTerm.jsx');

var Location = React.createClass({
  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  handleClickFactory: function(within) {
    return function() {
      console.log("User asked to filter by location");
    }.bind(this);
  },

  render: function () {
    var gene, location, region;

    gene = this.props.gene;
    location = gene.location;
    region = location.region;

    // if region is just a sequence of numerals
    if(/^\d+$/.test(region)) {
      region = 'Chromosome ' + region;
    }

    return (
      <div>
        <h5>Location</h5>
        <dl class="dl-horizontal">
          <dt>Region</dt>
          <dd>{region}</dd>
          <dt>Position</dt>
          <dd>{location.start} - {location.end}</dd>
          <dt>Filter</dt>
          <dd>
            <QueryTerm name="All genes on same region" handleClick={this.handleClickFactory()} />
            <QueryTerm name="All nearby genes" handleClick={this.handleClickFactory(100)} />
          </dd>
        </dl>
      </div>
    );
  }
});

module.exports = Location;