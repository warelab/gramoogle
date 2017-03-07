import React from 'react';

function initFireworks() {
  let fireworks = Reactome.Fireworks.create({
    proxyPrefix: 'http://www.reactome.org',
    placeHolder: 'fireworksHolder',
    width: 1140,
    height: 500
  });

  fireworks.onNodeSelected(function (obj) {
    console.log('selected node', obj);
  });
}

export default class Fireworks extends React.Component {
  constructor(props) {
    super(props);
    this.state = { };
  }

  componentDidMount() {
    if (Reactome && Reactome.Fireworks) {
      initFireworks();
    }
    else {
      window.addEventListener('launchFireworks', function (e) {
        initFireworks();
      }, false);
    }
  }

  render() {
    return (<div id="fireworksHolder"></div>);
  }
}
