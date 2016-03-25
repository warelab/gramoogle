'use strict';

import React from "react";
import {browser as Dalliance} from "gramene-dalliance";

export default class DallianceBrowser extends React.Component {

  shouldComponentUpdate() {
    return false;
  }

  biodallianceElementId() {
    return this.props.gene._id + 'Browser';
  }

  browser() {
    var g, start, end, span, padding, browser;
    g = this.props.gene;
    start = g.location.start;
    end = g.location.end;
    span = end - start + 1;
    padding = Math.floor(.1 * span);

    browser = new Dalliance(
      {
        pageName: this.biodallianceElementId(),
        chr: g.location.region,
        viewStart: start - padding,
        viewEnd: end + padding,
        cookieKey: g._id + 'BrowserCookie',

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
        noHelp: true
      }
    );
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
  expanded: React.PropTypes.bool
};