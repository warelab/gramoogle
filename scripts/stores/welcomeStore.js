import Reflux from "reflux";
import WelcomeActions from "../actions/welcomeActions";

const WelcomeStore = Reflux.createStore(
    {
      listenables: WelcomeActions,
      refreshBlogFeed: function () {
        console.log('refresh blog feed in the store');
      },
      refreshBlogFeedCompleted: function (results) {
        console.log('WelcomeActions.refreshBlogFeedCompleted', results);
        this.posts = results;
        this.trigger(this.posts);
      },
      refreshBlogFeedFailed: function (error) {
        console.log('WelcomeActions.refreshBlogFeedFailed', error);
      }
    });

export default WelcomeStore;