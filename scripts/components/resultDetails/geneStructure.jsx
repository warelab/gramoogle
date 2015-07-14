'use strict';

var React = require('react');
var Dalliance = require('dalliance').browser;
var bs = require('react-bootstrap');

var DallianceBrowser = React.createClass({

  propTypes: {
    gene: React.PropTypes.object.isRequired
  },

  shouldComponentUpdate: function() {
    return false;
  },

  browser: function() {
    var g = this.props.gene;
    var span = g.end - g.start + 1;
    var padding = Math.floor(.1*span);

    var browser = new Dalliance(
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
        maxWorkers: 2,
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
    var gene, ensemblUrl;

    gene = this.props.gene;

    // TODO: USe CSS Substring matching to put little icon after link to ensembl
    // http://blog.teamtreehouse.com/css3-substring-matching-attribute-selectors
    ensemblUrl = '//ensembl.gramene.org/' + gene.system_name + '/Gene/Summary?g=' + gene.id;
    return (
      <bs.Row>
        <bs.Col xs={12} md={12}>
          <div id={gene.id + 'Browser'}></div>
          <a className="biodalliance-link-to-ensembl" href={ensemblUrl}>Ensembl Gene view</a>
        </bs.Col>
      </bs.Row>
    );
  }
});
module.exports = DallianceBrowser;