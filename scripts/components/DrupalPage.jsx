import React from 'react';
import axios from "axios";
import Spinner from './Spinner.jsx';
import { browserHistory } from 'react-router';
import _ from 'lodash';
import closest from 'component-closest';


export default class DrupalPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      aliases: {}
    };
  }

  componentWillMount() {
    // populate this.state.aliases
    this.fetchAliases();
  }

  getNid(params) {
    if (params.drupalPath) {
      if (this.state.aliases && this.state.aliases[params.drupalPath]) {
        return this.state.aliases[params.drupalPath];
      }
    }
    else if (params.drupalNode) {
      return params.drupalNode;
    }
    return null;
  }

  componentDidMount() {
    window.scrollTo(0, 0);
    // this.initListener();
    // this.nid = this.getNid(this.props.params);
    // if (this.nid) {
    //   this.iframe.src = `/ww/${this.nid}`;
    // }
  }

  componentDidUpdate(prevProps, prevState) {
    window.scrollTo(0, 0);
  }

  initListener() {
    let iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;
    if (typeof iframeDoc.addEventListener !== "undefined") {
      iframeDoc.addEventListener("click", this.iframeClickHandler.bind(this), true);
    } else if (typeof iframeDoc.attachEvent !== "undefined") {
      iframeDoc.attachEvent("onclick", this.iframeClickHandler.bind(this));
    }
  }

  componentWillReceiveProps(nextProps) {
    let nextNid = this.getNid(nextProps.params);
    if (nextNid && this.nid !== nextNid) {
      this.nid = nextNid;
      this.iframe.src = `/ww/${this.nid}`;
    }
  }

  iframeClickHandler(e) {
    let target = e.target || e.srcElement;
    target = closest(target, 'a');
    let href = target.getAttribute('href');
    let drupalLink;
    let matches = href.match(/(node\/\d+)$/);
    if (!matches) {
      matches = href.match(/gramene\.org\/(.+)/);
      if (matches && this.state.aliases[matches[1]]) {
        drupalLink = matches[1];
      }
    }
    else {
      drupalLink = matches[1];
    }
    if (drupalLink) {
      e.preventDefault();
      browserHistory.push('/'+drupalLink);
    }
  }

  componentWillUnmount () {
    this.ignoreLastFetch = true;
  }

  fetchAliases () {
    let url = `/aliases`;
    axios.get(url).then(response => {
      if (!this.ignoreLastFetch) {
        this.setState({ aliases: response.data });
      }
    })
  }

  render() {
    let src;
    this.nid = this.getNid(this.props.params);
    if (this.nid) {
      src = `/ww/${this.nid}`;
    }
    const setIframeRef = (elem) => {
      // TODO ignoring null here is probably a bad idea.
      if(!_.isNull(elem)) {
        this.iframe = elem;
      }
    }

    //onLoad={this.initListener.bind(this)}
    return (
      <iframe src={src} ref={setIframeRef} onLoad={this.initListener.bind(this)} frameBorder="0" width="100%" height="650px">
        <p>browser doesn't support iframes</p>
      </iframe>
    );

    // let nid = null;
    // if (this.props.params.drupalPath) {
    //   if (this.state.aliases[this.props.params.drupalPath]) {
    //     nid = this.state.aliases[this.props.params.drupalPath];
    //   }
    // }
    // else if (this.props.params.drupalNode) {
    //   nid = this.props.params.drupalNode;
    // }
    // if (nid) {
    //   return (
    //     <iframe ref={(elem) => { this.drupalIframe = elem; }} src={`/ww/${nid}`} frameBorder="0" width="100%" height="650px">
    //       <p>browser doesn't support iframes</p>
    //     </iframe>
    //   );
    // }
    // else {
    //   return <Spinner />;
    // }
  }
}
