import React from 'react';
import {Button} from 'react-bootstrap';

const TEST_TOKEN = 'MjAxNzAzMDkxNTE4MjBfMjI%3D';

export default class Fireworks extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isTokenSet: false
    };
  }

  initFireworks() {
    this.fireworks = Reactome.Fireworks.create({
      proxyPrefix: '//reactomedev.oicr.on.ca',
      placeHolder: 'fireworksHolder',
      width: 1140,
      height: 500
    });

    this.fireworks.onNodeSelected(function (obj) {
      console.log('selected node', obj);
    });

    this.fireworks.onNodeHovered(function (obj) {
      if (obj) {
        console.log('hovered node', obj);
      }
    });

    // this.fireworks.onAnalysisReset(function () {
    //   console.log('onAnalysisReset callback');
    //   this.setState({isTokenSet: false});
    // }.bind(this));

    this.fireworks.onFireworksLoaded(function(id) {
      console.log('FireworksLoaded',id);
      this.fireworks.setAnalysisToken(TEST_TOKEN,'TOTAL');
      this.setState({isTokenSet: true});
    }.bind(this));
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

  handleClick() {
    if (this.state.isTokenSet)
      this.fireworks.resetAnalysis();
    else
      this.fireworks.setAnalysisToken(TEST_TOKEN, 'TOTAL');
    this.setState({isTokenSet: !this.state.isTokenSet});
  }

  render() {
    const setTokenButton = (this.state.isTokenSet) ? null :
      (<Button onClick={()=>this.handleClick()}>Show overrepresented pathways</Button>);

    return (
      <div>
        <div id="fireworksHolder"></div>
        {setTokenButton}
      </div>
    );
  }
}
