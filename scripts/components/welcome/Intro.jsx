import React from 'react';

import {Jumbotron, Button} from 'react-bootstrap';

const Intro = ({onClose}) => <Jumbotron className="gramene-intro">
  <Button bsClass="close" onClick={onClose}>&times;</Button>
  <p>Welcome to the Maize pan-genome <i>beta</i> site</p>
</Jumbotron>;

Intro.propTypes = {
  onClose: React.PropTypes.func.isRequired
};

export default Intro;