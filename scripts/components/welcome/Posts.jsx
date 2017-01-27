import React from 'react';
import { browserHistory } from 'react-router';


export default class Posts extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div className="posts-wrapper">
        <h3>Latest News</h3>
        <ul className="posts list-unstyled">
          {this.props.feed.map(
              (post) => <li key={post.guid}><a onClick={(event) => browserHistory.push(post.link.replace(/.*gramene\.org/,''))}>{post.title}</a></li>)
          }
        </ul>
      </div>
    );
  }
}

Posts.propTypes = {
  feed: React.PropTypes.array.isRequired
};
