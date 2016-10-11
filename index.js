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

// the HAR currently being analyzed
// this variable is set whenever the user uploads a new HAR file
var activeHlsSession = null;

app.use(logger);

app.use(express.static(__dirname + '/public'));
app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap'));

app.post('/har', upload.single('har-file'), function(request, response, next) {
  var error;

  try {
    activeHlsSession = JSON.parse(request.file.buffer.toString('utf8'));
  } catch(e) {
    error = {};
    error[e.name] = e.message;
    return response.status(500).send(error);
  }
  response.sendStatus(200);
});

app.listen(7777, function() {
  console.log('HLS HAR Analyzer running at http://localhost:7777/\n');
});
