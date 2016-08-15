import axios from "axios";
import _ from "lodash";
import RSSParser from "rss-parser";
import Q from "q";

export const parseFeed = (response) => {
  console.log(response);
  return Q.nfcall(RSSParser.parseString, response.data);
};

const getBlogFeed = () => axios.get("http://gramene.org/blog/feed")
                               .then(parseFeed)
                               .then((rss)=> {
                                 console.log(rss);
                                 return _.get(rss, 'feed.entries');
                               });

export default getBlogFeed;