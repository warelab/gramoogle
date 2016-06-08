import React from 'react';

const Posts = ({posts}) => <div>
  <h3>Latest News</h3>
  <ul className="posts list-unstyled">
    {posts.map(
        (post) => <li key={post.guid}><a href={post.link}>{post.title}</a></li>)
    }
  </ul>
</div>;

Posts.propTypes = {
  posts: React.PropTypes.array.isRequired
};

export default Posts;