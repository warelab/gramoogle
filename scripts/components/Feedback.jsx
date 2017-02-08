import React from 'react';
import Recaptcha from 'react-recaptcha';
import { FormGroup, FormControl, Form, ControlLabel, InputGroup, Col, Button } from 'react-bootstrap';
import isEmail from 'is-email';
import _ from 'lodash';

export default class Feedback extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      referrer: 'No referrer',
      subject: '',
      content: '',
      name: '',
      email: '',
      org: ''
    };
  }

  componentWillMount() {
    if (document.referrer) {
      this.setState({referrer : document.referrer});
    }
  }

  handleChange(e) {
    let nextState = _.cloneDeep(this.state);
    nextState[e.target.id] = e.target.value;
    this.setState(nextState);
  }

  validateField(fieldName) {
    if (fieldName === 'subject') {
      const length = this.state.subject.length;
      if (length > 10) return 'success';
      else if (length > 5) return 'warning';
      else if (length > 0) return 'error';
    }
    if (fieldName === 'name') {
      const length = this.state.name.length;
      if (length > 4) return 'success';
      else if (length > 2) return 'warning';
      else if (length > 0) return 'error';
    }
    if (fieldName === 'email') {
      const length = this.state.email.length;
      if (isEmail(this.state.email))
        return 'success';
      else if (length > 0)
        return 'error';
    }
    if (fieldName === 'org') {
      const length = this.state.org.length;
      if (length > 2) return 'success';
      else if (length > 1) return 'warning';
      else if (length > 0) return 'error';
    }
  }

  submitForm() {
    this.setState({submittedForm: true});
  }

  verifyRecaptcha(response) {
    this.setState({recaptcha: response});
  }

  loadRecaptcha() {
    console.log('loaded recaptcha');
  }

  formIsValid() {
    return (this.validateField('subject') === 'success'
      && this.validateField('name') === 'success'
      && this.validateField('email') === 'success'
      && this.validateField('org') === 'success'
      && this.state.recaptcha
    )
  }

  renderForm() {
    let submit = this.formIsValid() ? (
      <FormGroup>
        <Col smOffset={3} sm={9}>
          <Button onClick={this.submitForm.bind(this)}>
            Send your feedback
          </Button>
        </Col>
      </FormGroup>
    ) : '';
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

          <FormGroup controlId="subject" validationState={this.validateField("subject")}>
            <Col componentClass={ControlLabel} sm={3}>
              Subject
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.subject}
                onChange={this.handleChange.bind(this)}
              />
              <FormControl.Feedback />
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

          <FormGroup controlId="name" validationState={this.validateField('name')}>
            <Col componentClass={ControlLabel} sm={3}>
              Your Name
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.name}
                onChange={this.handleChange.bind(this)}
              />
              <FormControl.Feedback />
            </Col>
          </FormGroup>

          <FormGroup controlId="email" validationState={this.validateField('email')}>
            <Col componentClass={ControlLabel} sm={3}>
              Your Email
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.email}
                onChange={this.handleChange.bind(this)}
              />
              <FormControl.Feedback />
            </Col>
          </FormGroup>

          <FormGroup controlId="org" validationState={this.validateField('org')}>
            <Col componentClass={ControlLabel} sm={3}>
              Organization
            </Col>
            <Col sm={9}>
              <FormControl
                type="text"
                value={this.state.org}
                onChange={this.handleChange.bind(this)}
              />
              <FormControl.Feedback />
            </Col>
          </FormGroup>
          <FormGroup>
            <Col smOffset={3} sm={9}>
              <Recaptcha
                sitekey="6LcDFdMSAAAAABJNbBf5O18x3LA4h1cb0dlclHY8"
                render="explicit"
                verifyCallback={this.verifyRecaptcha.bind(this)}
                onloadCallback={this.loadRecaptcha}
              />
            </Col>
          </FormGroup>
          {submit}
        </Form>
      </div>
    );
  }

  renderThanks() {
    return (
      <div>Thanks<pre>{JSON.stringify(this.state,null,2)}</pre></div>
    );
  }

  render() {
    if (this.state.submittedForm) {
      return this.renderThanks();
    }
    else {
      return this.renderForm();
    }
  }
}
