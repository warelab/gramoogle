import _ from "lodash";
import React from "react";
import {Modal, Button} from "react-bootstrap";

const BlogModal = ({blog, close}) => {

  function createMarkup() {
    return {
      __html: blog.content
    }
  }

  return (
      <Modal show={true} onHide={close}>
        <Modal.Header closeButton>
          <Modal.Title>{blog.title}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
    <div dangerouslySetInnerHTML={createMarkup()} />
        </Modal.Body>

        <Modal.Footer>
          <Button primary onClick={close}>Close</Button>
        </Modal.Footer>
      </Modal>
  );
};

export default BlogModal;


