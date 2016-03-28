'use strict';

var React = require('react');
var Dalliance = require('gramene-dalliance').browser;
var bs = require('react-bootstrap');

var DallianceBrowser = React.createClass({

  propTypes: {
    settings: React.PropTypes.object.isRequired
  },

  // shouldComponentUpdate: function() {
  //   return false;
  // },

  browser: function() {
    var settings = this.props.settings;

    var browser = new Dalliance(
      {
        pageName: settings.taxon_id + '-Browser',
        chr: settings.region,
        viewStart: settings.start,
        viewEnd: settings.end,
        cookieKey: settings.taxon_id + 'BrowserCookie',
        
        coordSystem: {
          speciesName: settings.species,
          taxon: settings.taxon_id,
          auth: ' ',
          version: ' '
        },
        
        sources: [
          {
            name: 'DNA',
            ensemblURI: 'http://data.gramene.org/ensembl',
            species: settings.system_name,
            tier_type: 'sequence'
          },
          {
            name: 'Genes',
            uri: 'http://data.gramene.org/ensembl',
            tier_type: 'ensembl',
            species: settings.system_name,
            type: ['gene','transcript','exon','cds']
          }
        ],
        disablePoweredBy: true,
        setDocumentTitle: false,
        // noDefaultLabels: true,
        noPersist: true,
        noPersistView: true,
        maxWorkers: 2,
        // noTitle: true,
        // noLocationField: !this.props.expanded,
        // noLeapButtons: !this.props.expanded,
        // noZoomSlider: !this.props.expanded,
        // noTrackAdder: !this.props.expanded,
        // noTrackEditor: true,
        // noExport: true,
        // noOptions: !this.props.expanded,
        // noHelp: true
      }
    );
  },
  cancel: function() {
    if(typeof this.timeoutID == "number") {
      global.clearTimeout(this.timeoutID);
      delete this.timeoutID;
    }
  },
  componentDidMount: function () {
    // this.browser();
    this.cancel();
    var self = this;
    this.timeoutID = global.setTimeout(function() {self.browser();}, 20);
  },
  componentDidUpdate: function () {
    // this.browser();
    this.cancel();
    var self = this;
    this.timeoutID = global.setTimeout(function() {self.browser();}, 20);
  },
  componentWillUnmount: function () {
    this.cancel();
  },
  render: function () {
    var settings = this.props.settings;
    return (
      <bs.Row>
        <bs.Col xs={12} md={12}>
          <div id={settings.taxon_id + '-Browser'}></div>
        </bs.Col>
      </bs.Row>
    );
  }
});
module.exports = DallianceBrowser;