'use strict';

require('babel-register')({
  presets: ['es2015']
});

var fs = require('q-io/fs');
var getBlogFeed = require('./welcome/getDrupalContent').getBlogFeed;
var done;

getBlogFeed()
    .then((feed) => {console.log(feed); return feed})
    .then((feed) => 
        fs.write('static/blogFeed.json', JSON.stringify(feed))
    )
    .then(() => {console.log("we are done")})
    .then(()=>done = true)
    .catch((e)=>console.log("ERROR", e.message, e.stack));

(function wait () {
  if (!done) {
    console.log('waiting');
    setTimeout(wait, 1000);
  }
  else {
    console.log('done');
  }
})();