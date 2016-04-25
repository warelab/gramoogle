import React from 'react';
import keyBy from 'lodash/keyBy';
import { Grid, Row, Col } from 'react-bootstrap';

export class Detail extends React.Component {
  render() {
    var subComponents = keyBy(this.props.children, 'key');
    console.log(subComponents, this.props.children);
    return (
      <Grid fluid className="detail">
        <Row className="intro">
          {subComponents.title}
          {subComponents.description}
        </Row>
        <Row className="content-wrapper">
          {subComponents.content}
        </Row>
        <Row className="actions">
          <Col className="action-wrapper" xs={12} sm={4}>
            {subComponents.explore}
          </Col>
          <Col className="action-wrapper" xs={12} sm={8}>
            {subComponents.links}
          </Col>
        </Row>
      </Grid>
    );
  }
}

export { default as Title } from './title.jsx';
export { default as Description } from './description.jsx';
export { default as Content } from './content.jsx';
export { default as Explore } from './explore.jsx';
export { default as Links } from './links.jsx';
