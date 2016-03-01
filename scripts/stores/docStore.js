'use strict';

var Reflux = require('reflux');
var _ = require('lodash');

var DocActions = require('../actions/docActions');

function index(docs) {
  var result;
  if(_.isArray(docs)) {
    result = _.keyBy(docs, '_id');
  }
  else if(docs._id) {
    result = {};
    result[docs._id] = docs;
  }
  else {
    throw new Error("Can't index! Maybe this thing doesn't have an _id property: " + doc);
  }
  return result;
}

var DocStore = Reflux.createStore({
  listenables: DocActions,
  init: function() {
    this.docs = {};
    this.trigger = _.debounce(this.trigger, 250);
  },
  needDocsCompleted: function (results) {
    var indexedDocs, collectionName, collection, docs;
    collectionName = results.collection;
    collection = this.docs[collectionName];
    docs = results.docs;
    indexedDocs = index(docs, '_id');
    if(!collection) {
      this.docs[collectionName] = indexedDocs;
      console.log('needDocsCompleted new docs', collectionName, docs);
      this.trigger(this.docs);
    }
    else {
      // only notify listeners if we have a new doc to add.
      var shouldTrigger = ! _.reduce(indexedDocs, function(should, doc, id) {
        var docAlreadyPresent = !!collection[id];
        if(!docAlreadyPresent) {
          collection[id] = doc;
        }
        return should && docAlreadyPresent;
      }, true);

      if(shouldTrigger) {
        this.trigger(this.docs);
      }
    }
  },
  needDocsFailed: function (err) {
    console.log('needGeneFailed', err);
  },
  noLongerNeedDocs: function (collection, id) {
    var coll = this.docs[collection];
    console.log('noLongerNeedDocs', collection, id);
    if(coll) {
      this.docs[collection] = _.omit(coll, id);
    }
  }
});

module.exports = DocStore;