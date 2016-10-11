var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));
app.use('/bootstrap', express.static(__dirname + '/node_modules/bootstrap'));

app.listen(7777, function() {
  console.log('HLS HAR Analyzer running at http://localhost:7777/');
});
