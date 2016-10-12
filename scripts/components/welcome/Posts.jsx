import React from 'react';
//
// const Posts = ({posts}) => <div>
//   <h3>Latest News</h3>
//   <ul className="posts list-unstyled">
//     {posts.map(
//         (post) => <li key={post.guid}><a href={post.link}>{post.title}</a></li>)
//     }
//   </ul>
// </div>;
//
// Posts.propTypes = {
//   posts: React.PropTypes.array.isRequired
// };
//
// export default Posts;

import BlogModal from "./BlogModal.jsx";


export default class Posts extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showModal: false
    };
  }

  show(post) {
    this.selectedPost = post;
    this.setState({showModal: true})
  }

  closeModal() {
    this.setState({showModal: false});
  }
  
  render() {
    let modal;

    if (this.state.showModal) {
      modal = <BlogModal blog={this.selectedPost} close={this.closeModal.bind(this)}/>
    }

    return (
      <div className="posts-wrapper">
        <h3>Latest News</h3>
        <ul className="posts list-unstyled">
          {this.props.posts.map(
              (post) => <li key={post.guid}><a onClick={(event) => this.show(post)}>{post.title}</a></li>)
          }
        </ul>
          {modal}
      </div>
    );
  }
}

Posts.propTypes = {
  posts: React.PropTypes.array.isRequired
};
