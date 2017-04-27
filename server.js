var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var request = require('request');
var path = require('path');
var compression = require('compression');
var schedule = require('node-schedule');
var mysql = require('mysql');
var soap = require('soap');
var Email = require('email').Email;
var argv = require('minimist')(process.argv.slice(2));

const drupalArgs = {
  host: argv.h,
  user: argv.u,
  password: argv.p,
  database: argv.d
};
const recaptchaSecret = argv.s;
const mantisUser = argv.m;
const mantisPass = argv.n;

var app = express();
app.use(cors());
app.use(compression());
app.use(bodyParser.urlencoded({ extended: false}));
app.use(bodyParser.json());

var aliasLUT = {};

function updateLUT() {
  var drupalDb = mysql.createConnection(drupalArgs);
  drupalDb.query("select source, alias from url_alias", function(err, rows, fields) {
    if (err) {
      console.log('error connecting to drupal db',err);
    }
    else {
      rows.forEach(function(row) {
        aliasLUT[row.alias] = row.source.replace(/node\//,'');
      })
    }
  });
  drupalDb.end();
}

updateLUT();
schedule.scheduleJob({minute:[0,5,10,15,20,25,30,35,40,45,50,55]}, updateLUT);


// serve our static stuff like index.css
app.use(express.static(path.join(__dirname, 'build')))

app.get('/aliases', function (req, res) {
  res.json(aliasLUT)
});

app.get('/ww/:nid', function (req, res) {
  let url = `http://news.gramene.org/ww?nid=${req.params.nid}`;
  request.get(url).pipe(res); // just proxying
});

app.post('/feedback', function (req, res) {
  let comments = req.body.content;
  if (comments.length > 10000) {
    comments = comments.substr(0,10000);
    comments += "\n[MESSAGE TRUNCATED]";
  }
  let message = [
    `URL         : ${req.body.referrer}`,
    `Subject     : ${req.body.subject}`,
    `Name        : ${req.body.name}`,
    `Email       : ${req.body.email}`,
    `Organization: ${req.body.org}`,
    `Comments    : ${comments}`
  ].join("\n\n");
  let subject = `Site Feedback: ${req.body.subject}`;
  request.post({
    url: 'https://www.google.com/recaptcha/api/siteverify',
    formData: {secret: recaptchaSecret, response: req.body.recaptcha}
  },function(err, response, body) {
    let check = JSON.parse(body);
    if (err) {
      res.json({error: err});
    }
    if (check.success) {
      // submit the ticket
      const url = 'http://warelab.org/bugs/api/soap/mantisconnect.php?wsdl';
      soap.createClient(url, function(err, client) {
        if (err) {
          res.json({error: 'soap error'});
        }
        client.mc_issue_add({
          username: mantisUser,
          password: mantisPass,
          issue: {
            project: {
              id: 2
            },
            category: 'Uncategorized',
            summary: subject,
            description: message
          }
        }, function(err, result) {
          if (err) {
            res.json({error: 'error adding issue: ' + err});
          }
          else {
            const ticket = result.return.$value;
            var myMsg = new Email(
              { from: "feedback@gramene.org"
                , to: "feedback@gramene.org"
                , cc: req.body.email
                , 'reply-to' : `${req.body.email}, feedback@gramene.org`
                , subject: subject
                , body: `${message}\n\nhttp://www.warelab.org/bugs/view.php?id=${ticket}\n`
              });

            myMsg.send();

            res.json({ticket:ticket});
          }
        });
      });
    }
    else {
      res.json({error: check});
    }
  });
});

// send all requests to static.html so browserHistory works
app.get('*', function (req, res) {
  res.sendFile(path.join(__dirname, 'build', 'static.html'))
});

var PORT = process.env.PORT || 8080;

app.listen(PORT, function() {
  console.log('Production Express server running at localhost:' + PORT)
});

