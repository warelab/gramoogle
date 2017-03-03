import React from 'react';


export default class Fireworks extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
    };
  }

  componentDidMount()  {
    let fireworks = Reactome.Fireworks.create({
      proxyPrefix : 'http://www.reactome.org',
      placeHolder : 'fireworksHolder',
      width : this.divWrapper.clientWidth,
      height : 650
    });
    
    fireworks.onNodeSelected(function(obj) {
      console.log('selected node',obj);
    });
  }

  render() {
    return (
      <div ref={(div) => {this.divWrapper = div;}}>
        <div id="fireworksHolder"></div>
      </div>
    );
  }
}
