'use strict';

var React = require('react');
var bs = require('react-bootstrap');

var DallianceBrowser = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  shouldComponentUpdate: function(props) {
    return false;
  },

  browser: function() {
    var g = this.props.gene;
    var span = g.end - g.start + 1;
    var padding = Math.floor(.1*span);
    new Browser(
      {
        pageName: g.id + 'Browser',
        chr: g.region,
        viewStart: g.start-padding,
        viewEnd: g.end+padding,
        cookieKey: g.id + 'BrowserCookie',
        
        coordSystem: {
          speciesName: g.species,
          taxon: g.taxon_id,
          auth: 'Gramene',
          version: '3'
        },
        
        sources: [
          {
            name: 'DNA',
            ensemblURI: 'http://data.gramene.org/ensembl',
            species: g.system_name,
            tier_type: 'sequence'
          },
          {
            name: 'Genes',
            uri: 'http://data.gramene.org/ensembl',
            tier_type: 'ensembl',
            species: g.system_name,
            type: ['gene','transcript','exon','cds']
          }
        ],
        disablePoweredBy: true,
        setDocumentTitle: false,
        noDefaultLabels: true,
        noPersist: true,
        noPersistView: true,
        maxWorkers: 0,
        noTitle: true,
        noLocationField: true,
        noLeapButtons: true,
        noZoomSlider: true,
        noTrackAdder: true,
        noTrackEditor: true,
        noExport: true,
        noOptions: true,
        noHelp: true
      }
    );
  },
  cancel: function() {
    if(typeof this.timeoutID == "number") {
      window.clearTimeout(this.timeoutID);
      delete this.timeoutID;
    }
  },
  componentDidMount: function () {
    // this.browser();
    this.cancel();
    var self = this;
    this.timeoutID = window.setTimeout(function() {self.browser();}, 200);
  },
  componentWillUnmount: function () {
    this.cancel();
  },
  render: function () {
    var gene = this.props.gene;
    return (
      <bs.Row>
        <bs.Col xs={12} md={8}>
          <div id={gene.id + 'Browser'}></div>
        </bs.Col>
        <bs.Col xs={12} md={4}>
          <bs.Button bsSize="small">full screen</bs.Button>
        </bs.Col>
      </bs.Row>
    );
  }
});
module.exports = DallianceBrowser;