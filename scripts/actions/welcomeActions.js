import Reflux from "reflux";
import getBlogFeed from "../welcome/getBlogFeed.js";
import Q from 'q';

const WelcomeActions = Reflux.createActions([
    {'refreshBlogFeed': {asyncResult: true}},
    {'flashSearchBox': {asyncResult: true}}
]);

console.log(WelcomeActions);

WelcomeActions.refreshBlogFeed.listen(function () {
  console.log("Will refreshBlog Feed");
  getBlogFeed()
      .then(this.completed)
      .catch(this.failed);
});

WelcomeActions.flashSearchBox.listen(function (delayMs = 500) {
  const deferred = Q.defer();
  setTimeout(()=>deferred.resolve("finish"), delayMs);
  deferred.promise.then(this.completed);
  return "start";
});

export default WelcomeActions;