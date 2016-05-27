import Reflux from "reflux";
import RSSParser from "rss-parser";
import Q from "q";
import axios from "axios";
import _ from "lodash";

const WelcomeActions = Reflux.createActions({
                                              'refreshBlogFeed': {asyncResult: true}
                                            });

// const getBlogFeed = () => Q.nfcall(RSSParser.parseURL, "http://gramene.org/blog/feed");
const parseFeed = (response) => {
  console.log(response);
  return Q.nfcall(RSSParser.parseString, response.data);
};
const getBlogFeed = () => axios.get("http://gramene.org/blog/feed")
                               .then(parseFeed)
                               .then((rss)=> {
                                 console.log(rss);
                                 return _.get(rss, 'feed.entries');
                               });

WelcomeActions.refreshBlogFeed.listen(function () {
  console.log("Will refreshBlog Feed");
  getBlogFeed()
      .then(this.completed)
      .catch(this.failed);
});

export default WelcomeActions;