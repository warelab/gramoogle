import React from "react";
import _ from "lodash";
import ResultDetailLink from './ResultDetailLink.jsx';
import {Button, Modal} from 'react-bootstrap';

export default class ResultDetails extends React.Component {

  constructor(props) {
    super(props);
    this.state = {fullScreen: false};
  }

  toggleModal() {
    this.setState({fullScreen: !this.state.fullScreen});
  }

  renderVisibleDetailElement({visibleDetail, geneDoc, docs, speciesName}) {
    if (visibleDetail) {
      const visibleDetailComponent = visibleDetail.reactClass;
      let resizeStyle = {'ariaHidden': "true", float: "right"};
      let resizeClass = this.state.fullScreen ? "glyphicon glyphicon-resize-small" : "glyphicon glyphicon-resize-full";
      if (this.state.fullScreen)
        return (
          <div className="visible-detail">
            <Modal
              show={this.state.fullScreen}
              onHide={() => this.toggleModal()}
              dialogClassName="detail-modal"
            >
              <Modal.Header closeButton>
                <Modal.Title>
                  <div className="result-gene-title-body">
                    <h3 className="gene-title">
                      <span className="gene-name" style={{color: '#557B74'}}>{geneDoc.name}</span>&nbsp;
                      <small className="gene-id">{geneDoc._id}</small>&nbsp;
                      <small className="gene-species" style={{'font-style': 'italic'}}>{speciesName}</small>
                    </h3>
                    <p className="gene-description">{geneDoc.description}</p>
                  </div>
                </Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {React.createElement(visibleDetailComponent, {gene: geneDoc, docs, closeModal: this.toggleModal.bind(this)})}
              </Modal.Body>
            </Modal>
          </div>
        )
      else
        return (
          <div className="visible-detail">
            <Button
              style={resizeStyle}
              onClick={() => this.toggleModal()}>
              <span className={resizeClass}/>
            </Button>
            {React.createElement(visibleDetailComponent, {gene: geneDoc, docs})}
          </div>
        )
    }
  }

  renderDetailLinks(props) {

    return _.map(props.details, (resultDetail, key) =>
      <ResultDetailLink key={key}
                        detail={resultDetail}
                        {...props} />);
  }

  render() {
    return (
      <div className="result-content">
        <ul className="result-links">
          {this.renderDetailLinks(this.props)}
        </ul>
        {this.renderVisibleDetailElement(this.props)}
      </div>
    );
  }
}

ResultDetails.propTypes = {
  details: React.PropTypes.array.isRequired,
  enabled: React.PropTypes.bool.isRequired,
  visibleDetail: React.PropTypes.object,
  hoverDetailCapability: React.PropTypes.string,
  onDetailSelect: React.PropTypes.func.isRequired,
  geneDoc: React.PropTypes.object,
  docs: React.PropTypes.object
};
