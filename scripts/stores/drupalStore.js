import _ from 'lodash';
import Reflux from "reflux";
import DrupalActions from "../actions/drupalActions";

const DrupalStore = Reflux.createStore(
    {
      listenables: DrupalActions,
      init: function () {
        this.state = {
          feed: []
        }
      },
      refreshBlogFeedCompleted: function (results) {
        // console.log('DrupalActions.refreshBlogFeedCompleted', results);
        this.state = _.assign({}, this.state, {feed: results});
        this.trigger(this.state);
      },
      refreshBlogFeedFailed: function (error) {
        console.log('DrupalActions.refreshBlogFeedFailed', error);
      // },
      // fetchDrupalPageCompleted: function (results) {
      //   console.log('DrupalActions.fetchDrupalPageCompleted', results);
      //   this.state = _.assign({}, this.state, results);
      //   this.trigger(this.state);
      // },
      // fetchDrupalPageFailed: function (error) {
      //   console.log('DrupalActions.fetchDrupalPageFailed', error);
      }
    });

export default DrupalStore;