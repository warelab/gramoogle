import Reflux from "reflux";
import {getBlogFeed} from "../welcome/getDrupalContent.js";
// import Q from 'q';

const DrupalActions = Reflux.createActions([
  {'refreshBlogFeed': {asyncResult: true}},
  // {'fetchDrupalPage': {asyncResult: true}}
]);

// console.log(DrupalActions);

DrupalActions.refreshBlogFeed.listen(function () {
  console.log("Will refreshBlog Feed");
  getBlogFeed()
    .then(this.completed)
    .catch(this.failed);
});

// DrupalActions.fetchDrupalPage.listen(function (url) {
//   console.log("Will fetchDrupalPage from", url);
//   getDrupalPage(url)
//     .then(this.completed)
//     .catch(this.failed);
// });

export default DrupalActions;