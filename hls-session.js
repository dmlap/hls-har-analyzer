'use strict';

let aes = require('aes-decrypter');
let m3u8 = require('m3u8-parser');
let URL = require('url');

let mimes = require('./mime-types');
let TS_MIME_TYPE = mimes.TS_MIME_TYPE;
let M3U8_MIME_TYPE = mimes.M3U8_MIME_TYPE;
let KEY_MIME_TYPE = mimes.KEY_MIME_TYPE;

let findHeaderValue = function(headers, name) {
  let header = headers.find(function(header) {
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
  let m3u8Parser;
  let result = [];
  let lastM3U8;
  let lastKey;
  let decrypter;

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

      m3u8Parser = new m3u8.Parser();
      m3u8Parser.push(new Buffer(entry.response.content.text, 'base64').toString());
      lastM3U8 = m3u8Parser.manifest;
      lastM3U8.uri = entry.request.url;

      return result.push(entry);
    }
    // TS files
    if (TS_MIME_TYPE.test(entry.response.contentType)) {

      // annotate the entry with info from the last M3U8
      if (lastM3U8) {
        let segmentIndex = lastM3U8.segments.findIndex((segment) => {
          return URL.resolve(lastM3U8.uri, segment.uri) === entry.request.url;
        });
        let segment = lastM3U8.segments[segmentIndex];

        if (segment) {
          entry.duration = segment.duration || lastM3U8.targetDuration;

          if (lastKey) {
            entry.iv = segment.key.iv || new Uint32Array([
              0, 0, 0,
              lastM3U8.mediaSequence + segmentIndex
            ]);
            entry.key = lastKey;
          }
        }
      }

      return result.push(entry);
    }

    // decryption keys
    if (KEY_MIME_TYPE.test(entry.response.contentType) &&
        entry.response.bodySize === 16) {
      let keyContent;

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
