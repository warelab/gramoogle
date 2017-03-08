import React from 'react';


export default class Fireworks extends React.Component {
  constructor(props) {
    super(props);
    this.state = { };
  }

  initFireworks() {
    let fireworks = Reactome.Fireworks.create({
      proxyPrefix: 'http://www.reactome.org',
      placeHolder: 'fireworksHolder',
      width: 1140,
      height: 500
    });

    fireworks.onNodeSelected(function (obj) {
      console.log('selected node', obj);
    });

    fireworks.onNodeHovered(function (obj) {
      if (obj) {
        console.log('hovered node', obj);
      }
    });

    fireworks.onFireworksLoaded(function(id) {
      console.log('FireworksLoaded',id);
      fireworks.highlightNode('R-HSA-5673001');
      fireworks.highlightNode('R-HSA-68962');
    });
  }

  componentDidMount() {
    if (Reactome && Reactome.Fireworks) {
      this.initFireworks();
    }
    else {
      window.addEventListener('launchFireworks', function (e) {
        this.initFireworks();
      }, false);
    }
  }

  render() {
    return (<div id="fireworksHolder"></div>);
  }
}
