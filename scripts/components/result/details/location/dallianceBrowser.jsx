import React from "react";
import isEqual from "lodash/isEqual";
import {browser as Dalliance} from "gramene-dalliance";

// calculate this once.
const PREFIX = (global.location ? global.location.origin + global.location.pathname : '')
  + 'assets/gramene-dalliance/';

export default class DallianceBrowser extends React.Component {

  constructor(props) {
    super(props);
    this.initialVisibleRange = props.visibleRange;
  }

  shouldComponentUpdate(newProps) {
    // should we reset the view to initial state?
    if(isEqual(newProps.visibleRange, this.initialVisibleRange)) {
      this.browser.setLocation(newProps.visibleRange.chr, newProps.visibleRange.start, newProps.visibleRange.end);
    }

    return false;
  }

  biodallianceElementId() {
    return this.props.gene._id + 'Browser';
  }

  browser() {
    var g, view, start, end, browser;
    g = this.props.gene;
    view = this.props.visibleRange;
    start = view.start;
    end = view.end;

    this.browser = browser = new Dalliance(
      {
        pageName: this.biodallianceElementId(),
        chr: g.location.region,
        viewStart: start,
        viewEnd: end,
        cookieKey: g._id + 'BrowserCookie',
        prefix: PREFIX,

        coordSystem: {
          speciesName: g.system_name,
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
            type: ['gene', 'transcript', 'exon', 'cds']
          }
        ],
        disablePoweredBy: true,
        setDocumentTitle: false,
        noDefaultLabels: true,
        noPersist: true,
        noPersistView: true,
        maxWorkers: 2,
        noTitle: true,
        noLocationField: !this.props.expanded,
        noLeapButtons: !this.props.expanded,
        noZoomSlider: !this.props.expanded,
        noTrackAdder: !this.props.expanded,
        noTrackEditor: true,
        noExport: true,
        noOptions: !this.props.expanded,
        noHelp: true,
        maxViewWidth: 1000000
      }
    );
    
    browser.addViewListener(this.props.onViewChange);
  }

  cancel() {
    if (typeof this.timeoutID == "number") {
      window.clearTimeout(this.timeoutID);
      delete this.timeoutID;
    }
  }

  componentDidMount() {
    // this.browser();
    this.cancel();
    var self = this;
    this.timeoutID = window.setTimeout(function () {self.browser();}, 200);
  }

  componentWillUnmount() {
    this.cancel();
  }

  render() {
    return (
      <div id={this.biodallianceElementId()}></div>
    );
  }
}

DallianceBrowser.propTypes = {
  gene: React.PropTypes.object.isRequired,
  visibleRange: React.PropTypes.object.isRequired,
  expanded: React.PropTypes.bool,
  onViewChange: React.PropTypes.func.isRequired
};