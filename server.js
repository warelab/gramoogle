var express = require('express');
var path = require('path');
var compression = require('compression');
var schedule = require('node-schedule');
var mysql = require('mysql');
var argv = require('minimist')(process.argv.slice(2));

var app = express();

app.use(compression());


var aliasLUT = {};

function updateLUT() {
  var drupalDb = mysql.createConnection({
    host: argv.h,
    user: argv.u,
    password: argv.p,
    database: argv.d
  });
  drupalDb.query("select source, alias from url_alias", function(err, rows, fields) {
    if (err) throw err;
    rows.forEach(function(row) {
      aliasLUT[row.alias] = row.source.replace(/node\//,'');
    })
  });
  drupalDb.end();
}

updateLUT();
var updateJob = schedule.scheduleJob({minute:[0,5,10,15,20,25,30,35,40,45,50,55]}, updateLUT);


// serve our static stuff like index.css
app.use(express.static(path.join(__dirname, 'build')))

app.get('/aliases', function (req, res) {
  res.json(aliasLUT)
});

// send all requests to index.html so browserHistory works
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'build', 'index.html'))
});

var PORT = process.env.PORT || 8080;

app.listen(PORT, function() {
  console.log('Production Express server running at localhost:' + PORT)
});

