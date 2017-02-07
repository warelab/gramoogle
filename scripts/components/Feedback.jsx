import React from 'react';
import { FormGroup, FormControl, Form, ControlLabel, InputGroup, Col, Button } from 'react-bootstrap';
import _ from 'lodash';

export default class Feedback extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      completedForm: false,
      referrer: 'No referrer',
      subject: '',
      content: '',
      name: '',
      email: '',
      org: ''
    };
  }

  componentWillMount() {
    this.setState({referrer: document.referrer});
  }

  handleChange(e) {
    let nextState = _.cloneDeep(this.state);
    nextState[e.target.id] = e.target.value;
    this.setState(nextState);
  }

  submitForm() {
    this.setState({completedForm: true});
  }

  renderForm() {
    return (
      <div>
        <h3>
          Questions? Comments? Please let us know.
        </h3>
        <Form horizontal>
          <FormGroup controlId="referrer">
            <Col componentClass={ControlLabel} sm={3}>
              Refer to
            </Col>
            <Col sm={9}>
              <FormControl.Static>
                {this.state.referrer}
              </FormControl.Static>
            </Col>
          </FormGroup>

          <FormGroup controlId="subject">
            <Col componentClass={ControlLabel} sm={3}>
              Subject
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.subject}
                onChange={this.handleChange.bind(this)}
              />
            </Col>
          </FormGroup>

          <FormGroup controlId="content">
            <Col componentClass={ControlLabel} sm={3}>
              Questions/Comments
            </Col>
            <Col sm={9}>
              <FormControl
                componentClass="textarea"
                value={this.state.content}
                onChange={this.handleChange.bind(this)}
              />
            </Col>
          </FormGroup>

          <FormGroup controlId="name">
            <Col componentClass={ControlLabel} sm={3}>
              Your Name
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.name}
                onChange={this.handleChange.bind(this)}
              />
            </Col>
          </FormGroup>

          <FormGroup controlId="email">
            <Col componentClass={ControlLabel} sm={3}>
              Your Email
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.email}
                onChange={this.handleChange.bind(this)}
              />
            </Col>
          </FormGroup>

          <FormGroup controlId="org">
            <Col componentClass={ControlLabel} sm={3}>
              Organization
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.org}
                onChange={this.handleChange.bind(this)}
              />
            </Col>
          </FormGroup>

          <FormGroup>
            <Col smOffset={3} sm={9}>
              <Button onClick={this.submitForm.bind(this)}>
                Send your feedback
              </Button>
            </Col>
          </FormGroup>
        </Form>
      </div>
    );
  }

  renderThanks() {
    return (
      <div>Thanks</div>
    );
  }

  render() {
    if (this.state.completedForm) {
      return this.renderThanks();
    }
    else {
      return this.renderForm();
    }
  }
}
