import Reflux from "reflux";
import getBlogFeed from "../welcome/getBlogFeed.js";

const WelcomeActions = Reflux.createActions(
    {'refreshBlogFeed': {asyncResult: true}}
);

WelcomeActions.refreshBlogFeed.listen(function () {
  console.log("Will refreshBlog Feed");
  getBlogFeed()
      .then(this.completed)
      .catch(this.failed);
});

export default WelcomeActions;