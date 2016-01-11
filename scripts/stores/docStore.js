'use strict';

var Reflux = require('reflux');
var _ = require('lodash');

var DocActions = require('../actions/docActions');

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
    indexedDocs = _.indexBy(docs, '_id');
    if(!collection) {
      this.docs[collectionName] = indexedDocs;
      console.log('needDocsCompleted new docs', collectionName, docs);
      this.trigger(this.docs);
    }
    else {
      // only notify listeners if we have a new doc to add.
      var shouldTrigger = ! _.every(indexedDocs, function(doc, id) {
        var docAlreadyPresent = !!collection[id];
        if(!docAlreadyPresent) {
          collection[id] = doc;
        }
        return docAlreadyPresent;
      });

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