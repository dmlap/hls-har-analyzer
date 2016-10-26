'use strict';

var aes = require('aes-decrypter');

var TS_MIME_TYPE = /video\/mp2t/i;
var M3U8_MIME_TYPE = /application\/vnd.apple.mpegurl|application\/x-mpegurl/i;
var KEY_MIME_TYPE = /application\/octet-stream/i;

var findHeaderValue = function(headers, name) {
  var header = headers.find(function(header) {
    return header.name === name;
  }) || {};
  return header.value;
};

/**
 * Filter a parsed HAR file for activity related to HLS playback.
 * @param har {object} - a parsed HAR file
 * @return an array of HLS request and responses objects
 * @see http://www.softwareishard.com/blog/har-12-spec/
 */
module.exports = function collectHlsSession(har) {
  var lastM3u8;
  var lastKey;
  let keyContent;
  var decrypter;
  var result = [];


  har.log.entries.forEach(function(entry) {
    // annotate the response objects with the content type found in
    // the headers
    entry.response.contentType = findHeaderValue(entry.response.headers,
                                                 'Content-Type');

    if (entry.request.method !== 'GET') {
      return;
    }

    // m3u8s
    if (M3U8_MIME_TYPE.test(entry.response.contentType)) {
      return result.push(entry);
    }
    // TS files
    if (TS_MIME_TYPE.test(entry.response.contentType)) {

      if (lastKey) {
        entry.key = lastKey;
      }

      return result.push(entry);
    }

    // decryption keys
    if (KEY_MIME_TYPE.test(entry.response.contentType) &&
        entry.response.bodySize === 16) {
      keyContent = new Buffer(entry.response.content.text, 'base64');
      lastKey = new Uint32Array([
        keyContent.readUInt32BE(0),
        keyContent.readUInt32BE(4),
        keyContent.readUInt32BE(8),
        keyContent.readUInt32BE(12)
      ]);
      result.push(entry);
    }
  });

  return result;
};
