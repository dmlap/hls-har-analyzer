var express = require('express');
var app = express();
var logger = require('morgan')('dev');
var multer = require('multer');
var upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 300 * 1024 * 1024 // 300MB
  }
});

var collectHlsSession = require('./hls-session');

// the HAR currently being analyzed
// this variable is set whenever the user uploads a new HAR file
var activeHlsSession = null;

app.use(logger);

app.use(express.static(__dirname + '/public'));
app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap'));

app.post('/har', upload.single('har-file'), function(request, response, next) {
  var error;
  var har;

  try {
    har = JSON.parse(request.file.buffer.toString('utf8'));
  } catch(e) {
    error = {};
    error[e.name] = e.message;
    return response.status(500).send(error);
  }

  if (!har || !har.log || !har.log.entries) {
    error = {
      InvalidHar: 'Unable to locate HTTP requests in the uploaded file'
    };
    return response.status(500).send(error);
  }

  activeHlsSession = collectHlsSession(har);

  response.status(200).send(activeHlsSession.map(function(entry) {
    return {
      request: {
        method: entry.request.method,
        url: entry.request.url
      },
      response: {
        status: entry.response.status,
        contentType: entry.response.contentType,
        bodySize: entry.response.bodySize
      }
    };
  }));
});

app.listen(7777, function() {
  console.log('HLS HAR Analyzer running at http://localhost:7777/\n');
});
