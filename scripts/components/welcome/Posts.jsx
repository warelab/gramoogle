import React from 'react';
import { browserHistory } from 'react-router';
import _ from "lodash";
import Spinner from "../Spinner.jsx";


export default class Posts extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let content;
    if(_.isEmpty(this.props.feed)) {
      content = <Spinner />
    }
    else {
      content = (
        <ul className="posts list-unstyled">
          {this.props.feed.map(
            (post) => <li key={post.guid}><a onClick={(event) => browserHistory.push(post.link.replace(/.*gramene\.org/,''))}>{post.title}</a></li>)
          }
        </ul>
      );
    }

    return (
      <div className="posts-wrapper">
        <h3>Latest News</h3>
        {content}
      </div>
    );
  }
}

Posts.propTypes = {
  feed: React.PropTypes.array.isRequired
};
