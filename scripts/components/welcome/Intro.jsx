import React from 'react';

import {Jumbotron, Button} from 'react-bootstrap';

const Intro = ({onClose}) => <Jumbotron className="gramene-intro">
  <Button bsClass="close" onClick={onClose}>&times;</Button>
  <p><strong>Gramene</strong> is a <em>curated</em>, <em>open-source</em>, <em>
    integrated</em> data resource for comparative
    functional genomics in crops and model
    plant species.</p>
</Jumbotron>;

Intro.propTypes = {
  onClose: React.PropTypes.func.isRequired
};

export default Intro;